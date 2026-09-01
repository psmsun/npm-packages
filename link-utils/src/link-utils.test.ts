import { describe, expect, it } from "vitest";
import { isBareDomain, withScheme, withTrailingSlash } from "./externalUrl.js";
import { resolveHref } from "./resolveHref.js";

describe("isBareDomain", () => {
  it("accepts hostnames without a scheme", () => {
    expect(isBareDomain("mosbuild.com")).toBe(true);
    expect(isBareDomain("summit.rosupack.com")).toBe(true);
    expect(isBareDomain("mosbuild.com/programme")).toBe(true);
  });

  it("rejects paths, anchors and full URLs", () => {
    expect(isBareDomain("/programme")).toBe(false);
    expect(isBareDomain("#speakers")).toBe(false);
    expect(isBareDomain("https://mosbuild.com")).toBe(false);
    expect(isBareDomain("")).toBe(false);
  });

  it("rejects filenames that look like hostnames", () => {
    expect(isBareDomain("brochure.pdf")).toBe(false);
    expect(isBareDomain("sitemap.xml")).toBe(false);
  });
});

describe("withScheme", () => {
  it("prefixes https:// only for bare domains", () => {
    expect(withScheme("mosbuild.com")).toBe("https://mosbuild.com");
    expect(withScheme("/programme")).toBe("/programme");
    expect(withScheme("https://itegroup.com")).toBe("https://itegroup.com");
    expect(withScheme("brochure.pdf")).toBe("brochure.pdf");
  });
});

describe("withTrailingSlash", () => {
  it("appends a slash to internal routes and trims whitespace", () => {
    expect(withTrailingSlash("/sectors")).toBe("/sectors/");
    expect(withTrailingSlash("/sectors ")).toBe("/sectors/");
    expect(withTrailingSlash("/sectors/")).toBe("/sectors/");
  });

  it("preserves query strings and hashes", () => {
    expect(withTrailingSlash("/sectors?a=1")).toBe("/sectors/?a=1");
    expect(withTrailingSlash("/sectors#top")).toBe("/sectors/#top");
  });

  it("leaves external URLs and static files alone", () => {
    expect(withTrailingSlash("https://itegroup.com")).toBe(
      "https://itegroup.com",
    );
    expect(withTrailingSlash("/brochure.pdf")).toBe("/brochure.pdf");
  });
});

// These lock the extraction to the behaviour of the NavigationLink component
// every ITE site shipped before this package existed. A failure here means the
// packaged version diverges from what 27 sites render today.
describe("resolveHref", () => {
  it("gives a bare domain a scheme and opens it in a new tab", () => {
    expect(resolveHref("mosbuild.com")).toEqual({
      href: "https://mosbuild.com",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("keeps internal routes internal, in the same tab", () => {
    expect(resolveHref("/programme")).toEqual({
      href: "/programme",
      target: "_self",
    });
  });

  it("does NOT add a trailing slash (matches existing site behaviour)", () => {
    expect(resolveHref("/programme").href).toBe("/programme");
  });

  it("adds a leading slash to a schemeless relative path", () => {
    expect(resolveHref("programme").href).toBe("/programme");
  });

  it("repairs the /https:// typo", () => {
    expect(resolveHref("/https://itegroup.com")).toEqual({
      href: "https://itegroup.com",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("falls back to / for empty, blank and missing values", () => {
    expect(resolveHref("").href).toBe("/");
    expect(resolveHref("   ").href).toBe("/");
    expect(resolveHref(undefined).href).toBe("/");
  });

  it("treats anchors, mailto and tel as external but same-tab", () => {
    expect(resolveHref("#speakers")).toEqual({
      href: "#speakers",
      target: "_self",
    });
    expect(resolveHref("mailto:a@b.com")).toEqual({
      href: "mailto:a@b.com",
      target: "_self",
    });
    expect(resolveHref("tel:+441234")).toEqual({
      href: "tel:+441234",
      target: "_self",
    });
  });

  it("disables prefetch for static files, not for routes", () => {
    expect(resolveHref("/brochure.pdf").prefetch).toBe(false);
    expect(resolveHref("/sitemap.xml").prefetch).toBe(false);
    expect(resolveHref("/brochure.pdf?v=2").prefetch).toBe(false);
    expect(resolveHref("/programme").prefetch).toBeUndefined();
  });

  it("honours an explicit target over the computed one", () => {
    expect(resolveHref("https://itegroup.com", "_self")).toEqual({
      href: "https://itegroup.com",
      target: "_self",
    });
    expect(resolveHref("/programme", "_blank")).toEqual({
      href: "/programme",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("collapses accidental double slashes", () => {
    expect(resolveHref("/sectors//food").href).toBe("/sectors/food");
  });
});
