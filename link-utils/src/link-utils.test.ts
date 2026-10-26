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

  it("leaves protocol-relative URLs alone", () => {
    expect(withTrailingSlash("//example.com/path?x=1")).toBe(
      "//example.com/path?x=1",
    );
  });

  it("treats .rss and .ics as static files", () => {
    expect(withTrailingSlash("/feed.rss")).toBe("/feed.rss");
    expect(withTrailingSlash("/event.ics")).toBe("/event.ics");
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

// Where 1.0.1 deliberately diverges from the sites' NavigationLink.
describe("resolveHref 1.0.1 fixes", () => {
  const blocked = { href: "/", target: "_self" };

  it("resolves javascript: and vbscript: hrefs to / like an empty href", () => {
    expect(resolveHref("javascript://%0Aalert(1)")).toEqual(blocked);
    expect(resolveHref('javascript:alert(1);void("https://x")')).toEqual(blocked);
    expect(resolveHref("javascript:alert(1)")).toEqual(blocked);
    expect(resolveHref("vbscript:msgbox(1)")).toEqual(blocked);
  });

  it("blocks unsafe schemes in any case and with whitespace", () => {
    expect(resolveHref("JaVaScRiPt:alert(1)")).toEqual(blocked);
    expect(resolveHref("java\tscript:alert(1)")).toEqual(blocked);
    expect(resolveHref(" javascript:alert(1)")).toEqual(blocked);
  });

  it("keeps an explicit target on a blocked href", () => {
    expect(resolveHref("javascript:alert(1)", "_top")).toEqual({
      href: "/",
      target: "_top",
    });
  });

  it("still passes data: through unchanged", () => {
    expect(resolveHref("data:text/plain,hi")).toEqual({
      href: "data:text/plain,hi",
      target: "_self",
    });
  });

  it("matches schemes case-insensitively", () => {
    expect(resolveHref("MAILTO:a@b.com")).toEqual({
      href: "MAILTO:a@b.com",
      target: "_self",
    });
    expect(resolveHref("HTTPS://x.com")).toEqual({
      href: "HTTPS://x.com",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(resolveHref("/HTTPS://x.com")).toEqual({
      href: "HTTPS://x.com",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("collapses double slashes only in the path of a schemeless value", () => {
    expect(resolveHref("/search?next=//cdn.example/a//b").href).toBe(
      "/search?next=//cdn.example/a//b",
    );
    expect(resolveHref("/a//b#x//y").href).toBe("/a/b#x//y");
    expect(resolveHref("https://site.example/a//b?q=x//y").href).toBe(
      "https://site.example/a//b?q=x//y",
    );
    expect(resolveHref("//cdn.example/a//b").href).toBe("//cdn.example/a//b");
    expect(resolveHref("mosbuild.com//a").href).toBe("https://mosbuild.com/a");
  });

  it("shares one file-extension list with withTrailingSlash", () => {
    expect(resolveHref("event.ics")).toEqual({
      href: "/event.ics",
      target: "_self",
      prefetch: false,
    });
    expect(resolveHref("/a.ico").prefetch).toBe(false);
    expect(resolveHref("/archive.rar").prefetch).toBe(false);
  });
});
