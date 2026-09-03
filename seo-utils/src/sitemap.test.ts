import { describe, expect, it, vi } from "vitest";
import {
  createSitemapNoIndex,
  DEFAULT_CONTENT_TYPES,
  normalizeSitemapPath,
  parseRedirectsApiUrl,
} from "./sitemap.js";

const REDIRECTS =
  "https://ite-cms.prismetic.com/api/pharmtech-v2-redirects?pagination[pageSize]=500";
const BASE = "https://ite-cms.prismetic.com";
const FILTER =
  "filters%5Bseo%5D%5BnoIndex%5D%5B%24eq%5D=true&pagination%5BpageSize%5D=500";
const url = (uid: string, field: string) =>
  `${BASE}/api/${uid}?${FILTER}&fields%5B0%5D=${field}`;

type Routes = Record<string, unknown>;
function fakeFetch(routes: Routes, calls: string[] = []) {
  return async (u: string) => {
    calls.push(u);
    const hit = routes[u];
    if (hit === "boom") throw new Error("network");
    if (hit === undefined) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => hit };
  };
}

describe("normalizeSitemapPath", () => {
  it.each([
    [null, "/"],
    [undefined, "/"],
    ["", "/"],
    ["/", "/"],
    ["   ", "/"],
    ["about", "/about"],
    ["/about/", "/about"],
    ["about///", "/about"],
    ["  /a/b/ ", "/a/b"],
    [42, "/42"],
  ])("%j → %s", (input, expected) => {
    expect(normalizeSitemapPath(input)).toBe(expected);
  });
});

describe("parseRedirectsApiUrl", () => {
  it("reads the prod box", () => {
    expect(parseRedirectsApiUrl(REDIRECTS)).toEqual({ apiBase: BASE, slugPrefix: "pharmtech-v2" });
  });
  it("reads the regional box", () => {
    expect(
      parseRedirectsApiUrl(
        "https://regional-ite-cms.itegroupnews.com/api/ros-upack-smt-redirects?pagination[pageSize]=500",
      ),
    ).toEqual({ apiBase: "https://regional-ite-cms.itegroupnews.com", slugPrefix: "ros-upack-smt" });
  });
  it("rejects anything else", () => {
    expect(parseRedirectsApiUrl("https://x.test/api/foo")).toBeNull();
    expect(parseRedirectsApiUrl(undefined)).toBeNull();
  });
});

describe("createSitemapNoIndex", () => {
  it("ships the five default collections in order", () => {
    expect(DEFAULT_CONTENT_TYPES).toEqual([
      { uid: "pages", field: "PagePath" },
      { uid: "articles", field: "Slug", prefix: "articles" },
      { uid: "sectors", field: "Slug", prefix: "sectors" },
      { uid: "medias", field: "Slug", prefix: "media-gallery" },
      { uid: "partners", field: "Slug", prefix: "partner" },
    ]);
  });

  it("requests exactly the legacy URLs and builds the legacy paths", async () => {
    const calls: string[] = [];
    const fetch = fakeFetch(
      {
        [url("pharmtech-v2-pages", "PagePath")]: { data: [{ PagePath: "about" }, { PagePath: "/contact/" }, { PagePath: "" }, null] },
        [url("pharmtech-v2-articles", "Slug")]: { data: [{ Slug: "foo" }] },
        [url("pharmtech-v2-sectors", "Slug")]: { data: [{ Slug: "bar" }] },
        [url("pharmtech-v2-medias", "Slug")]: { data: [{ Slug: "gal" }] },
        [url("pharmtech-v2-partners", "Slug")]: { data: [{ Slug: "acme" }] },
      },
      calls,
    );
    const { getNoIndexPathSetPromise } = createSitemapNoIndex({ fetch });
    const set = await getNoIndexPathSetPromise(REDIRECTS);
    expect([...set].sort()).toEqual(["/about", "/articles/foo", "/contact", "/media-gallery/gal", "/partner/acme", "/sectors/bar"]);
    expect(calls.sort()).toEqual(
      [
        url("pharmtech-v2-pages", "PagePath"),
        url("pharmtech-v2-articles", "Slug"),
        url("pharmtech-v2-sectors", "Slug"),
        url("pharmtech-v2-medias", "Slug"),
        url("pharmtech-v2-partners", "Slug"),
      ].sort(),
    );
  });

  it("tolerates a non-OK response and a thrown fetch, logging the failure", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = fakeFetch({
      [url("pharmtech-v2-pages", "PagePath")]: { data: [{ PagePath: "kept" }] },
      [url("pharmtech-v2-articles", "Slug")]: "boom",
      // sectors / medias / partners → 404
    });
    const set = await createSitemapNoIndex({ fetch }).getNoIndexPathSetPromise(REDIRECTS);
    expect([...set]).toEqual(["/kept"]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toBe("[sitemap] noIndex fetch failed for pharmtech-v2-articles:");
    error.mockRestore();
  });

  it("returns an empty set without fetching for an unparsable URL", async () => {
    const calls: string[] = [];
    const set = await createSitemapNoIndex({ fetch: fakeFetch({}, calls) }).getNoIndexPathSetPromise("https://x.test/nope");
    expect(set.size).toBe(0);
    expect(calls).toEqual([]);
  });

  it("caches per redirects URL within one instance", async () => {
    const calls: string[] = [];
    const api = createSitemapNoIndex({ fetch: fakeFetch({}, calls) });
    const a = api.getNoIndexPathSetPromise(REDIRECTS);
    const b = api.getNoIndexPathSetPromise(REDIRECTS);
    expect(a).toBe(b);
    await a;
    expect(calls.length).toBe(5);
    await createSitemapNoIndex({ fetch: fakeFetch({}, calls) }).getNoIndexPathSetPromise(REDIRECTS);
    expect(calls.length).toBe(10);
  });

  it("accepts per-site content types (Transrussia campaign pages, MUI media-library)", async () => {
    const calls: string[] = [];
    const fetch = fakeFetch(
      {
        [url("transrussia-campaign-pages", "PagePath")]: { data: [{ PagePath: "spring" }] },
        [url("transrussia-medias", "Slug")]: { data: [{ Slug: "m" }] },
      },
      calls,
    );
    const api = createSitemapNoIndex({
      fetch,
      contentTypes: [
        { uid: "campaign-pages", field: "PagePath", prefix: "lp" },
        { uid: "medias", field: "Slug", prefix: "media-library" },
      ],
    });
    const set = await api.getNoIndexPathSetPromise(`${BASE}/api/transrussia-redirects?pagination[pageSize]=500`);
    expect([...set].sort()).toEqual(["/lp/spring", "/media-library/m"]);
    expect(calls.length).toBe(2);
  });

  it("re-exports normalizeSitemapPath on the instance", () => {
    expect(createSitemapNoIndex().normalizeSitemapPath("x/")).toBe("/x");
  });
});
