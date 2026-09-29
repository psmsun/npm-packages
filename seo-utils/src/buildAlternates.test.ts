import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSitemapNoIndexFromBuild, inspectExportedAlternates } from "./sitemap.js";

const MOSBUILD_LINKS = `<link rel="canonical" href="https://mosbuildexpo.com/cn/"/><link rel="alternate" hrefLang="en" href="https://mosbuildexpo.com/"/><link rel="alternate" hrefLang="zh-CN" href="https://mosbuildexpo.com/cn/"/><link rel="alternate" hrefLang="zh" href="https://mosbuildexpo.com/cn/"/><link rel="alternate" hrefLang="x-default" href="https://mosbuildexpo.com/"/>`;
const ZH_HOME = `<!DOCTYPE html><html lang="zh-CN" dir="ltr"><head><meta charSet="utf-8"/><meta name="robots" content="index, follow"/><meta name="googlebot" content="index, follow"/>${MOSBUILD_LINKS}<meta property="og:locale" content="zh_CN"/></head><body><p>hi</p></body></html>`;

const SITE = "https://mosbuildexpo.com";
const CONFIG = { outDir: "out", siteUrl: SITE };

function page(links: Array<[string, string]>, head = `<meta name="robots" content="index, follow"/>`): string {
  const tags = links.map(([hreflang, href]) => `<link rel="alternate" hrefLang="${hreflang}" href="${href}"/>`);
  return `<!DOCTYPE html><html><head>${head}${tags.join("")}</head><body></body></html>`;
}

const ARTICLE_LINKS: Array<[string, string]> = [
  ["en", `${SITE}/articles/a/`],
  ["zh-CN", `${SITE}/cn/articles/b/`],
  ["zh", `${SITE}/cn/articles/b/`],
  ["ru", `${SITE}/ru/articles/c/`],
  ["x-default", `${SITE}/articles/a/`],
];

const NOINDEX = `<meta name="robots" content="noindex"/>`;
const REFRESH = `<meta http-equiv="refresh" content="0; url=/cn/articles/"/>`;

function disk(files: Record<string, string>) {
  const reads: string[] = [];
  const readFile = (file: string) => {
    reads.push(file);
    return file in files ? files[file] : null;
  };
  return { readFile, reads };
}

const refs = (links: Array<[string, string]>) =>
  links.map(([hreflang, href]) => ({ href, hreflang, hrefIsAbsolute: true }));

let errors: string[];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    errors.push(a.join(" "));
  });
});
afterEach(() => vi.restoreAllMocks());

describe("inspectExportedAlternates", () => {
  it("reads Mosbuild's four hreflang links in document order", () => {
    expect(inspectExportedAlternates(ZH_HOME)).toEqual([
      { hreflang: "en", href: "https://mosbuildexpo.com/" },
      { hreflang: "zh-CN", href: "https://mosbuildexpo.com/cn/" },
      { hreflang: "zh", href: "https://mosbuildexpo.com/cn/" },
      { hreflang: "x-default", href: "https://mosbuildexpo.com/" },
    ]);
  });

  it.each([
    ["single quotes", `<head><link rel='alternate' hreflang='en' href='https://x.test/a/'></head>`],
    ["unquoted", `<head><link rel=alternate hreflang=en href=https://x.test/a/ ></head>`],
    ["attributes in any order and case", `<head><LINK HREF="https://x.test/a/" HREFLANG="en" REL="Alternate"></head>`],
    ["rel with several tokens", `<head><link rel="nofollow alternate" hreflang="en" href="https://x.test/a/"></head>`],
  ])("%s", (_, html) => {
    expect(inspectExportedAlternates(html)).toEqual([{ hreflang: "en", href: "https://x.test/a/" }]);
  });

  it("decodes &amp; in href", () => {
    expect(
      inspectExportedAlternates(`<head><link rel="alternate" hrefLang="en" href="https://x.test/a/?p=1&amp;q=2"/></head>`),
    ).toEqual([{ hreflang: "en", href: "https://x.test/a/?p=1&q=2" }]);
  });

  it("decodes React's five attribute escapes", () => {
    expect(
      inspectExportedAlternates(
        `<head><link rel="alternate" hrefLang="en" href="https://x.test/women&#x27;s-day/?q=&quot;a&quot;&amp;r=&lt;b&gt;"/></head>`,
      ),
    ).toEqual([{ hreflang: "en", href: `https://x.test/women's-day/?q="a"&r=<b>` }]);
  });

  it("decodes once, so an escaped escape stays escaped", () => {
    expect(
      inspectExportedAlternates(`<head><link rel="alternate" hrefLang="en" href="https://x.test/a/?q=&amp;lt;&amp;#x27;"/></head>`),
    ).toEqual([{ hreflang: "en", href: "https://x.test/a/?q=&lt;&#x27;" }]);
  });

  it.each([
    ["an RSS alternate without hreflang", `<head><link rel="alternate" type="application/rss+xml" href="https://x.test/feed.xml"/></head>`],
    ["a canonical", `<head><link rel="canonical" href="https://x.test/a/"/></head>`],
    ["a rel that only contains the word", `<head><link rel="alternates" hreflang="en" href="https://x.test/a/"/></head>`],
    ["an empty hreflang", `<head><link rel="alternate" hreflang="" href="https://x.test/a/"/></head>`],
    ["no href", `<head><link rel="alternate" hreflang="en"/></head>`],
    ["a link in <body>", `<head></head><body><link rel="alternate" hreflang="en" href="https://x.test/a/"/></body>`],
  ])("ignores %s", (_, html) => {
    expect(inspectExportedAlternates(html)).toEqual([]);
  });
});

describe("alternateRefs", () => {
  const FILES = {
    "out/index.html": page([["en", `${SITE}/`], ["zh-CN", `${SITE}/cn/`], ["zh", `${SITE}/cn/`], ["x-default", `${SITE}/`]]),
    "out/cn/index.html": ZH_HOME,
    "out/articles/a/index.html": page(ARTICLE_LINKS),
    "out/cn/articles/b/index.html": page(ARTICLE_LINKS),
    "out/ru/articles/c/index.html": page(ARTICLE_LINKS),
  };

  it("returns the page's own alternates when every target is listed", () => {
    const { readFile } = disk(FILES);
    const { alternateRefs } = createSitemapNoIndexFromBuild({ readFile });
    expect(alternateRefs("/cn/", CONFIG)).toEqual(
      refs([["en", `${SITE}/`], ["zh-CN", `${SITE}/cn/`], ["zh", `${SITE}/cn/`], ["x-default", `${SITE}/`]]),
    );
    expect(alternateRefs("/articles/a/", CONFIG)).toEqual(refs(ARTICLE_LINKS));
    expect(errors).toEqual([]);
  });

  it("drops an alternate whose target is noindex", () => {
    const { readFile } = disk({ ...FILES, "out/cn/articles/b/index.html": page(ARTICLE_LINKS, NOINDEX) });
    const { alternateRefs } = createSitemapNoIndexFromBuild({ readFile });
    expect(alternateRefs("/articles/a/", CONFIG)).toEqual(
      refs([ARTICLE_LINKS[0], ARTICLE_LINKS[3], ARTICLE_LINKS[4]]),
    );
    expect(errors).toEqual([
      '[sitemap] Dropping hreflang "zh-CN" alternate https://mosbuildexpo.com/cn/articles/b/ from "/articles/a/"; the target is noindex.',
      '[sitemap] Dropping hreflang "zh" alternate https://mosbuildexpo.com/cn/articles/b/ from "/articles/a/"; the target is noindex.',
    ]);
  });

  it("drops an alternate whose target is a redirect, unless redirects are kept", () => {
    const files = { ...FILES, "out/ru/articles/c/index.html": page([], REFRESH) };
    expect(createSitemapNoIndexFromBuild({ readFile: disk(files).readFile }).alternateRefs("/articles/a/", CONFIG)).toEqual(
      refs([ARTICLE_LINKS[0], ARTICLE_LINKS[1], ARTICLE_LINKS[2], ARTICLE_LINKS[4]]),
    );
    expect(errors).toEqual([
      '[sitemap] Dropping hreflang "ru" alternate https://mosbuildexpo.com/ru/articles/c/ from "/articles/a/"; the target is a redirect.',
    ]);
    expect(
      createSitemapNoIndexFromBuild({ readFile: disk(files).readFile, excludeRedirects: false }).alternateRefs("/articles/a/", CONFIG),
    ).toEqual(refs(ARTICLE_LINKS));
  });

  it("drops an alternate whose target has no exported file", () => {
    const { ["out/ru/articles/c/index.html"]: _, ...files } = FILES;
    const { readFile, reads } = disk(files);
    expect(createSitemapNoIndexFromBuild({ readFile }).alternateRefs("/articles/a/", CONFIG)).toEqual(
      refs([ARTICLE_LINKS[0], ARTICLE_LINKS[1], ARTICLE_LINKS[2], ARTICLE_LINKS[4]]),
    );
    expect(reads).toContain("out/ru/articles/c.html");
    expect(errors).toEqual([
      '[sitemap] Dropping hreflang "ru" alternate https://mosbuildexpo.com/ru/articles/c/ from "/articles/a/"; the target has no exported file.',
    ]);
  });

  it("keeps an alternate on another origin without reading anything for it", () => {
    const { readFile, reads } = disk({
      "out/about/index.html": page([["en", `${SITE}/about/`], ["ru", "https://mosbuild.ru/o-nas/"]]),
    });
    expect(createSitemapNoIndexFromBuild({ readFile }).alternateRefs("/about/", CONFIG)).toEqual(
      refs([["en", `${SITE}/about/`], ["ru", "https://mosbuild.ru/o-nas/"]]),
    );
    expect(reads).toEqual(["out/about/index.html", "out/about/index.html"]);
  });

  it("keeps every alternate unverified when siteUrl is absent", () => {
    const { ["out/cn/articles/b/index.html"]: _, ...files } = FILES;
    const { readFile, reads } = disk(files);
    const { alternateRefs } = createSitemapNoIndexFromBuild({ readFile });
    expect(alternateRefs("/articles/a/", { outDir: "out" })).toEqual(refs(ARTICLE_LINKS));
    expect(alternateRefs("/articles/a/")).toEqual(refs(ARTICLE_LINKS));
    expect(reads).toEqual(["out/articles/a/index.html", "out/articles/a/index.html"]);
    expect(errors).toEqual([]);
  });

  it("drops an href that is not an absolute URL", () => {
    const { readFile } = disk({
      "out/about/index.html": page([["en", `${SITE}/about/`], ["ru", "/ru/about/"], ["de", "https://mosbuild.de/about/"]]),
    });
    expect(createSitemapNoIndexFromBuild({ readFile }).alternateRefs("/about/", CONFIG)).toEqual(
      refs([["en", `${SITE}/about/`], ["de", "https://mosbuild.de/about/"]]),
    );
    expect(errors).toEqual([
      '[sitemap] Dropping hreflang "ru" alternate /ru/about/ from "/about/"; the target is not an absolute URL.',
    ]);
  });

  it("returns [] when nothing is left but the page itself", () => {
    const { readFile } = disk({ ...FILES, "out/index.html": page([["en", `${SITE}/`]], NOINDEX) });
    const { alternateRefs } = createSitemapNoIndexFromBuild({ readFile });
    expect(alternateRefs("/cn/", CONFIG)).toEqual([]);
    expect(errors).toHaveLength(2);
  });

  it("returns [] for a page whose only alternate is itself", () => {
    const { readFile } = disk({
      "out/about/index.html": page([["en", `${SITE}/about/`], ["x-default", `${SITE}/about/`]]),
      "out/cn/index.html": ZH_HOME,
    });
    const { alternateRefs } = createSitemapNoIndexFromBuild({ readFile });
    expect(alternateRefs("/about/", CONFIG)).toEqual([]);
    expect(alternateRefs("/about", { outDir: "out" })).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("returns [] for a page with no alternates", () => {
    const { readFile } = disk({ "out/about/index.html": page([]) });
    expect(createSitemapNoIndexFromBuild({ readFile }).alternateRefs("/about/", CONFIG)).toEqual([]);
  });

  it("checks targets without onExclude or the missing-file line", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const onExclude = vi.fn();
    const { ["out/ru/articles/c/index.html"]: _, ...files } = FILES;
    const { readFile } = disk({ ...files, "out/cn/articles/b/index.html": page(ARTICLE_LINKS, NOINDEX) });
    const { alternateRefs } = createSitemapNoIndexFromBuild({ readFile, onExclude });
    expect(alternateRefs("/articles/a/", CONFIG)).toEqual([]);
    expect(onExclude).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(errors).toHaveLength(3);
    expect(errors.some((e) => e.includes("No exported file"))).toBe(false);
  });

  it("returns [] silently when the page's own file is missing", () => {
    const { readFile } = disk(FILES);
    expect(createSitemapNoIndexFromBuild({ readFile }).alternateRefs("/ghost/", CONFIG)).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("finds the target of an apostrophe slug", () => {
    const { readFile } = disk({
      "out/articles/women's-day/index.html": page([["en", `${SITE}/articles/women&#x27;s-day/`], ["zh-CN", `${SITE}/cn/articles/b/`]]),
      "out/cn/articles/b/index.html": page([]),
    });
    expect(createSitemapNoIndexFromBuild({ readFile }).alternateRefs("/articles/women's-day/", CONFIG)).toEqual(
      refs([["en", `${SITE}/articles/women's-day/`], ["zh-CN", `${SITE}/cn/articles/b/`]]),
    );
    expect(errors).toEqual([]);
  });

  it("follows the transform's outDir and the <path>.html fallback", () => {
    const { readFile } = disk({
      "public/about.html": page([["en", `${SITE}/about`], ["ru", `${SITE}/ru/about`]]),
      "public/ru/about.html": page([]),
    });
    expect(
      createSitemapNoIndexFromBuild({ readFile }).alternateRefs("/about", { outDir: "public", siteUrl: SITE }),
    ).toEqual(refs([["en", `${SITE}/about`], ["ru", `${SITE}/ru/about`]]));
  });
});

describe("cache", () => {
  const FILES = {
    "out/articles/a/index.html": page(ARTICLE_LINKS),
    "out/cn/articles/b/index.html": page(ARTICLE_LINKS),
    "out/ru/articles/c/index.html": page(ARTICLE_LINKS, NOINDEX),
  };

  function run(cache?: boolean) {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { readFile, reads } = disk(FILES);
    const buildNoIndex = createSitemapNoIndexFromBuild({ readFile, cache });
    const out = ["/articles/a/", "/cn/articles/b/", "/ru/articles/c/"].map((path) => [
      buildNoIndex.shouldExclude(path, CONFIG),
      buildNoIndex.alternateRefs(path, CONFIG),
      buildNoIndex.inspect(path, CONFIG),
    ]);
    return { out, reads };
  }

  it("reads each file once across shouldExclude, alternateRefs and inspect", () => {
    const { reads } = run(true);
    expect(reads).toEqual([
      "out/articles/a/index.html",
      "out/cn/articles/b/index.html",
      "out/ru/articles/c/index.html",
    ]);
  });

  it("gives the same answers as an uncached reader", () => {
    expect(run(true).out).toEqual(run().out);
  });

  it("reads on every call when omitted, as before", () => {
    const { reads } = run();
    expect(reads.filter((r) => r === "out/articles/a/index.html")).toHaveLength(9);
    const { readFile, reads: again } = disk(FILES);
    const { shouldExclude } = createSitemapNoIndexFromBuild({ readFile, cache: false });
    shouldExclude("/articles/a/", CONFIG);
    shouldExclude("/articles/a/", CONFIG);
    expect(again).toEqual(["out/articles/a/index.html", "out/articles/a/index.html"]);
  });

  it("caches a missing file too", () => {
    const { readFile, reads } = disk({});
    const { inspect } = createSitemapNoIndexFromBuild({ readFile, cache: true });
    inspect("/ghost/", CONFIG);
    inspect("/ghost/", CONFIG);
    expect(reads).toEqual(["out/ghost/index.html", "out/ghost.html"]);
    expect(errors).toHaveLength(2);
  });

  it("still ignores a refresh that sits in the body", () => {
    const html = `<!DOCTYPE html><html><head><title>Redirecting...</title></head><body><meta http-equiv="refresh" content="0; url=/x/"/></body></html>`;
    const { readFile } = disk({ "out/r/index.html": html });
    expect(createSitemapNoIndexFromBuild({ readFile, cache: true }).inspect("/r/", CONFIG)?.redirect).toBe(false);
  });

  it("works on the real filesystem", () => {
    const outDir = fileURLToPath(new URL("./__fixtures__/build", import.meta.url));
    const { inspect, shouldExclude } = createSitemapNoIndexFromBuild({ cache: true });
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(inspect("/", { outDir })).toEqual({ robots: "index, follow", noIndex: false, redirect: false });
    expect(shouldExclude("/showcase/", { outDir })).toBe(true);
    expect(shouldExclude("/go/", { outDir })).toBe(true);
  });
});
