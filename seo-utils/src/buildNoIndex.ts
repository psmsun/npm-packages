/**
 * Sitemap exclusions read from the exported HTML instead of the CMS.
 *
 * next-sitemap runs after `next build`, when every page is already a file under `outDir`
 * that states its own answer: `<meta name="robots" content="noindex">` from the page's
 * metadata, `<meta http-equiv="refresh">` from a StaticRedirect. Reading that covers
 * CMS-driven and code-owned pages alike — a `__placeholder__` that calls `notFound()`,
 * a showcase page with `robots: { index: false }` — with nothing to keep in sync and no
 * per-page regex in the config.
 *
 * Node-only, no React, no top-level await, so `next-sitemap.config.js` can `require` it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type BuildExcludeReason = "noindex" | "redirect";

export interface ExportedPage {
  /** Content of the first `<meta name="robots">`, or null when the page has none. */
  robots: string | null;
  /** True when any robots meta carries `noindex` or `none`. */
  noIndex: boolean;
  /** True when the page carries `<meta http-equiv="refresh">`. */
  redirect: boolean;
}

export interface BuildNoIndexOptions {
  /** Export directory. Defaults to the transform's `config.outDir`, then "out". */
  outDir?: string;
  /** Leave meta-refresh redirect pages out of the sitemap. Default true. */
  excludeRedirects?: boolean;
  /** Reads one exported file, null when it does not exist. Injectable for tests. */
  readFile?: (file: string) => string | null;
  /** Called once per excluded path. Defaults to one console.log line. */
  onExclude?: (path: string, reason: BuildExcludeReason) => void;
}

export interface SitemapTransformConfig {
  outDir?: string | null;
}

export interface BuildNoIndex {
  /** The exported page behind a sitemap path, or null when no file exists for it. */
  inspect(path: string, config?: SitemapTransformConfig): ExportedPage | null;
  /** True when the exported page must stay out of the sitemap. */
  shouldExclude(path: string, config?: SitemapTransformConfig): boolean;
}

const META_TAG = /<meta\b[^>]*>/gi;

function attr(tag: string, name: string): string | null {
  const m = new RegExp(
    `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i",
  ).exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}

/** What one exported HTML document says about itself. Only the `<head>` is read. */
export function inspectExportedHtml(html: string): ExportedPage {
  const headEnd = html.search(/<\/head\s*>/i);
  const head = headEnd === -1 ? html : html.slice(0, headEnd);
  let robots: string | null = null;
  let noIndex = false;
  let redirect = false;
  for (const tag of head.match(META_TAG) ?? []) {
    const name = attr(tag, "name");
    if (name !== null && name.trim().toLowerCase() === "robots") {
      const content = attr(tag, "content") ?? "";
      if (robots === null) robots = content;
      const directives = content.toLowerCase().split(",").map((d) => d.trim());
      if (directives.includes("noindex") || directives.includes("none")) noIndex = true;
      continue;
    }
    const equiv = attr(tag, "http-equiv");
    if (equiv !== null && equiv.trim().toLowerCase() === "refresh") redirect = true;
  }
  return { robots, noIndex, redirect };
}

/**
 * Files a sitemap path may live at. `trailingSlash: true` exports `/a/b/` as
 * `a/b/index.html`; without it `/a/b` is `a/b.html`. Both are tried, decoded as well.
 */
export function exportedFilesFor(path: string, outDir: string): string[] {
  const raw = String(path).split(/[?#]/)[0].trim().replace(/^\/+|\/+$/g, "");
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  const out: string[] = [];
  for (const p of decoded === raw ? [raw] : [raw, decoded]) {
    if (!p) {
      out.push(join(outDir, "index.html"));
      continue;
    }
    out.push(join(outDir, p, "index.html"), join(outDir, `${p}.html`));
  }
  return out;
}

function readExported(file: string): string | null {
  try {
    return readFileSync(file, "utf8");
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR" || code === "EISDIR") return null;
    console.error(`[sitemap] Could not read ${file}: ${(e as Error).message}`);
    return null;
  }
}

export function createSitemapNoIndexFromBuild(
  options: BuildNoIndexOptions = {},
): BuildNoIndex {
  const excludeRedirects = options.excludeRedirects ?? true;
  const read = options.readFile ?? readExported;
  const onExclude =
    options.onExclude ??
    ((path: string, reason: BuildExcludeReason) =>
      console.log(`[sitemap] Ignoring ${reason} path --> ${path}`));

  function outDirFor(config?: SitemapTransformConfig): string {
    return options.outDir ?? (config?.outDir || "out");
  }

  function inspect(path: string, config?: SitemapTransformConfig): ExportedPage | null {
    const files = exportedFilesFor(path, outDirFor(config));
    for (const file of files) {
      const html = read(file);
      if (html !== null) return inspectExportedHtml(html);
    }
    // Fail open: a page the sitemap cannot see is still a page. Say so.
    console.error(
      `[sitemap] No exported file for ${JSON.stringify(path)} (looked for ${files.join(", ")}); keeping it in the sitemap.`,
    );
    return null;
  }

  function shouldExclude(path: string, config?: SitemapTransformConfig): boolean {
    const page = inspect(path, config);
    if (!page) return false;
    const reason: BuildExcludeReason | null = page.noIndex
      ? "noindex"
      : excludeRedirects && page.redirect
        ? "redirect"
        : null;
    if (!reason) return false;
    onExclude(path, reason);
    return true;
  }

  return { inspect, shouldExclude };
}
