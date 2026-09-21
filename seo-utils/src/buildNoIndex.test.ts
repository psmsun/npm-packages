/**
 * `./sitemap`'s build-output mode. The head snippets are what Next 16 wrote into
 * Mosbuild's `out/` on 2026-09-21, byte for byte.
 */

import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSitemapNoIndexFromBuild,
  exportedFilesFor,
  inspectExportedHtml,
} from "./sitemap.js";

const INDEXED = `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><title>About</title><meta name="robots" content="index, follow"/><meta name="googlebot" content="index, follow"/><link rel="canonical" href="https://mosbuildexpo.com/about/"/></head><body><p>hi</p></body></html>`;
const SHOWCASE = `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><title>Campaign components</title><meta name="robots" content="noindex, nofollow"/><meta name="googlebot" content="noindex, nofollow"/></head><body></body></html>`;
const PLACEHOLDER = `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><meta name="robots" content="noindex"/><title>ExpoCifra</title></head><body><h2>Page Not Found</h2></body></html>`;
const REDIRECT = `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><title>Redirecting...</title></head><body><meta http-equiv="refresh" content="0; url=/sectors/building-materials/"/><div>Redirecting…</div></body></html>`;
const REDIRECT_IN_HEAD = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/vis-reg/"/><title>Redirecting...</title></head><body></body></html>`;
const NO_META = `<!DOCTYPE html><html><head><title>No Articles Available</title></head><body></body></html>`;

describe("inspectExportedHtml", () => {
  it.each([
    ["index, follow", INDEXED, { robots: "index, follow", noIndex: false, redirect: false }],
    ["noindex, nofollow", SHOWCASE, { robots: "noindex, nofollow", noIndex: true, redirect: false }],
    ["noindex from notFound()", PLACEHOLDER, { robots: "noindex", noIndex: true, redirect: false }],
    ["no robots meta", NO_META, { robots: null, noIndex: false, redirect: false }],
    ["refresh in head", REDIRECT_IN_HEAD, { robots: null, noIndex: false, redirect: true }],
  ])("%s", (_, html, expected) => {
    expect(inspectExportedHtml(html)).toEqual(expected);
  });

  it("does not read a refresh that sits in the body", () => {
    // StaticRedirect renders its <meta> inside the page; React hoists it into <head> in
    // the real export. If it ever stops, the page must not be silently kept.
    expect(inspectExportedHtml(REDIRECT).redirect).toBe(false);
  });

  it.each([
    ['content before name', `<head><meta content="noindex" name="robots"></head>`],
    ["single quotes", `<head><meta name='robots' content='noindex'></head>`],
    ["upper case", `<head><META NAME="Robots" CONTENT="NOINDEX, FOLLOW"></head>`],
    ["none", `<head><meta name="robots" content="none"></head>`],
    ["unquoted", `<head><meta name=robots content=noindex></head>`],
    ["extra whitespace", `<head><meta  name = "robots"   content = "noindex , nofollow" ></head>`],
    ["second of two robots metas", `<head><meta name="robots" content="index"><meta name="robots" content="noindex"></head>`],
  ])("reads noindex — %s", (_, html) => {
    expect(inspectExportedHtml(html).noIndex).toBe(true);
  });

  it.each([
    ["nofollow alone", `<head><meta name="robots" content="nofollow"></head>`],
    ["data-name attribute", `<head><meta data-name="robots" content="noindex"></head>`],
    ["googlebot only", `<head><meta name="googlebot" content="noindex"></head>`],
    ["escaped text", `<head><title>&lt;meta name="robots" content="noindex"&gt;</title></head>`],
    ["noindex as a substring", `<head><meta name="robots" content="max-snippet:-1, noindexing"></head>`],
    ["robots meta after </head>", `<head></head><body><meta name="robots" content="noindex"></body>`],
  ])("keeps — %s", (_, html) => {
    expect(inspectExportedHtml(html).noIndex).toBe(false);
  });

  it("reports the first robots content when several are present", () => {
    expect(
      inspectExportedHtml(`<head><meta name="robots" content="index"><meta name="robots" content="noindex"></head>`).robots,
    ).toBe("index");
  });

  it("reads the whole document when there is no </head>", () => {
    expect(inspectExportedHtml(`<meta name="robots" content="noindex">`).noIndex).toBe(true);
  });
});

describe("exportedFilesFor", () => {
  it.each([
    ["/", ["out/index.html"]],
    ["", ["out/index.html"]],
    ["/about/", ["out/about/index.html", "out/about.html"]],
    ["/about", ["out/about/index.html", "out/about.html"]],
    ["about", ["out/about/index.html", "out/about.html"]],
    ["/lp/campaign-components/", ["out/lp/campaign-components/index.html", "out/lp/campaign-components.html"]],
    ["/a/b/?x=1#y", ["out/a/b/index.html", "out/a/b.html"]],
  ])("%s", (path, files) => {
    expect(exportedFilesFor(path, "out")).toEqual(files);
  });

  it("tries the decoded path after the raw one", () => {
    expect(exportedFilesFor("/caf%C3%A9/", "out")).toEqual([
      "out/caf%C3%A9/index.html",
      "out/caf%C3%A9.html",
      "out/café/index.html",
      "out/café.html",
    ]);
  });

  it("survives a path that is not valid percent-encoding", () => {
    expect(exportedFilesFor("/100%/", "out")).toEqual(["out/100%/index.html", "out/100%.html"]);
  });

  it("uses the given outDir", () => {
    expect(exportedFilesFor("/x/", "dist/export")).toEqual(["dist/export/x/index.html", "dist/export/x.html"]);
  });
});

describe("createSitemapNoIndexFromBuild", () => {
  afterEach(() => vi.restoreAllMocks());

  function disk(files: Record<string, string>) {
    const reads: string[] = [];
    const readFile = (file: string) => {
      reads.push(file);
      return file in files ? files[file] : null;
    };
    return { readFile, reads };
  }

  const MOSBUILD = {
    "out/index.html": INDEXED,
    "out/about/index.html": INDEXED,
    "out/lp/campaign-components/index.html": SHOWCASE,
    "out/lp/__placeholder__/index.html": PLACEHOLDER,
    "out/pre-reg/index.html": REDIRECT_IN_HEAD,
    "out/articles/no-articles-available/index.html": NO_META,
  };

  it("excludes noindex pages and redirects, keeps the rest", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { readFile } = disk(MOSBUILD);
    const { shouldExclude } = createSitemapNoIndexFromBuild({ readFile });
    const config = { outDir: "out" };
    expect(shouldExclude("/", config)).toBe(false);
    expect(shouldExclude("/about/", config)).toBe(false);
    expect(shouldExclude("/lp/campaign-components/", config)).toBe(true);
    expect(shouldExclude("/lp/__placeholder__/", config)).toBe(true);
    expect(shouldExclude("/pre-reg/", config)).toBe(true);
    expect(log.mock.calls.map((c) => c[0])).toEqual([
      "[sitemap] Ignoring noindex path --> /lp/campaign-components/",
      "[sitemap] Ignoring noindex path --> /lp/__placeholder__/",
      "[sitemap] Ignoring redirect path --> /pre-reg/",
    ]);
  });

  it("keeps a page with no robots meta — the page, not the sitemap, must say noindex", () => {
    const { readFile } = disk(MOSBUILD);
    const { shouldExclude, inspect } = createSitemapNoIndexFromBuild({ readFile });
    expect(shouldExclude("/articles/no-articles-available/", { outDir: "out" })).toBe(false);
    expect(inspect("/articles/no-articles-available/", { outDir: "out" })).toEqual({
      robots: null,
      noIndex: false,
      redirect: false,
    });
  });

  it("keeps redirects when excludeRedirects is false", () => {
    const { readFile } = disk(MOSBUILD);
    const { shouldExclude } = createSitemapNoIndexFromBuild({ readFile, excludeRedirects: false });
    expect(shouldExclude("/pre-reg/", { outDir: "out" })).toBe(false);
  });

  it("fails open on a missing file and says so", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { readFile, reads } = disk(MOSBUILD);
    const { shouldExclude, inspect } = createSitemapNoIndexFromBuild({ readFile });
    expect(shouldExclude("/ghost/", { outDir: "out" })).toBe(false);
    expect(inspect("/ghost/", { outDir: "out" })).toBeNull();
    expect(reads).toEqual(["out/ghost/index.html", "out/ghost.html", "out/ghost/index.html", "out/ghost.html"]);
    expect(err).toHaveBeenCalledTimes(2);
    expect(err.mock.calls[0][0]).toBe(
      '[sitemap] No exported file for "/ghost/" (looked for out/ghost/index.html, out/ghost.html); keeping it in the sitemap.',
    );
  });

  it("falls back to <path>.html for a trailingSlash: false export", () => {
    const { readFile } = disk({ "out/about.html": SHOWCASE });
    const { shouldExclude } = createSitemapNoIndexFromBuild({ readFile });
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(shouldExclude("/about", { outDir: "out" })).toBe(true);
  });

  it("reads outDir from the transform config, then defaults to out", () => {
    const { readFile, reads } = disk({});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { inspect } = createSitemapNoIndexFromBuild({ readFile });
    inspect("/a/", { outDir: "public" });
    inspect("/a/");
    inspect("/a/", { outDir: "" });
    expect(reads).toEqual([
      "public/a/index.html", "public/a.html",
      "out/a/index.html", "out/a.html",
      "out/a/index.html", "out/a.html",
    ]);
  });

  it("an explicit outDir option wins over the transform config", () => {
    const { readFile, reads } = disk({});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { inspect } = createSitemapNoIndexFromBuild({ readFile, outDir: "build" });
    inspect("/a/", { outDir: "out" });
    expect(reads).toEqual(["build/a/index.html", "build/a.html"]);
  });

  it("calls onExclude with the reason instead of logging", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const seen: Array<[string, string]> = [];
    const { readFile } = disk(MOSBUILD);
    const { shouldExclude } = createSitemapNoIndexFromBuild({
      readFile,
      onExclude: (path, reason) => seen.push([path, reason]),
    });
    shouldExclude("/lp/campaign-components/", { outDir: "out" });
    shouldExclude("/pre-reg/", { outDir: "out" });
    shouldExclude("/about/", { outDir: "out" });
    expect(seen).toEqual([
      ["/lp/campaign-components/", "noindex"],
      ["/pre-reg/", "redirect"],
    ]);
    expect(log).not.toHaveBeenCalled();
  });

  it("reads the real filesystem by default", () => {
    const outDir = fileURLToPath(new URL("./__fixtures__/build", import.meta.url));
    const { inspect } = createSitemapNoIndexFromBuild();
    expect(inspect("/", { outDir })).toEqual({
      robots: "index, follow",
      noIndex: false,
      redirect: false,
    });
    expect(inspect("/showcase/", { outDir })?.noIndex).toBe(true);
    expect(inspect("/go/", { outDir })?.redirect).toBe(true);
  });
});
