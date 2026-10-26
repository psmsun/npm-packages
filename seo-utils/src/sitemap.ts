/**
 * The next-sitemap helpers: the build-output reader for noindex exclusions and hreflang
 * alternates, the robots.txt Content-Signal transform and the llms.txt generator. Consumed
 * by each site's next-sitemap.config.js, which is CommonJS and loads this ESM entry through
 * Node's require(esm) (Node 20.19+ / 22.12+). Keep this module free of top-level await and
 * of React so that keeps working. Node-only, never bundled.
 */

export {
  contentSignalRobotsTxt,
  DEFAULT_CONTENT_SIGNAL,
  type TransformRobotsTxt,
} from "./robots.js";
export {
  generateLlmsTxt,
  type LlmsTxtOptions,
  type PostFetchLike,
} from "./llmsTxt.js";
export {
  type BuildExcludeReason,
  type BuildNoIndex,
  type BuildNoIndexOptions,
  createSitemapNoIndexFromBuild,
  type ExportedAlternate,
  type ExportedPage,
  exportedFilesFor,
  inspectExportedAlternates,
  inspectExportedHtml,
  type SitemapAlternateRef,
  type SitemapTransformConfig,
} from "./buildNoIndex.js";

export function normalizeSitemapPath(p: unknown): string {
  if (p == null || p === "") return "/";
  let s = String(p).trim();
  if (s === "/" || s === "") return "/";
  s = s.replace(/\/+$/, "");
  if (!s.startsWith("/")) s = `/${s}`;
  return s;
}

export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
  status?: number;
  text?(): Promise<string>;
}>;
