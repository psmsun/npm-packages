/**
 * URL paths to leave out of the XML sitemap because their Strapi SEO record has
 * noIndex: true. Consumed by each site's next-sitemap.config.js, which is CommonJS
 * and loads this ESM entry through Node's require(esm) (Node 20.19+ / 22.12+). Keep
 * this module free of top-level await and of React so that keeps working.
 *
 * The same entry also carries the other next-sitemap helpers: the robots.txt
 * Content-Signal transform and the llms.txt generator (Node-only, never bundled).
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

const STRAPI_NOINDEX_FILTER =
  "filters%5Bseo%5D%5BnoIndex%5D%5B%24eq%5D=true&pagination%5BpageSize%5D=500";

export interface SitemapContentType {
  /** Strapi collection uid without the site's slug prefix: "articles" → "<site>-articles". */
  uid: string;
  /** Field holding the path or slug: "PagePath" for page-like types, "Slug" otherwise. */
  field: string;
  /** URL segment the slug lives under, e.g. "articles". Omit when the field is already a path. */
  prefix?: string | null;
}

/**
 * The collections every site checks. Override per site when the routes differ.
 *
 * `peoples` (speakers) joined the list in 2.1. Sites without that collection answer 404,
 * which is classified as "not on this site" and stays silent.
 */
export const DEFAULT_CONTENT_TYPES: readonly SitemapContentType[] = [
  { uid: "pages", field: "PagePath" },
  { uid: "articles", field: "Slug", prefix: "articles" },
  { uid: "sectors", field: "Slug", prefix: "sectors" },
  { uid: "medias", field: "Slug", prefix: "media-gallery" },
  { uid: "partners", field: "Slug", prefix: "partner" },
  { uid: "peoples", field: "Slug", prefix: "speakers" },
];

export function normalizeSitemapPath(p: unknown): string {
  if (p == null || p === "") return "/";
  let s = String(p).trim();
  if (s === "/" || s === "") return "/";
  s = s.replace(/\/+$/, "");
  if (!s.startsWith("/")) s = `/${s}`;
  return s;
}

/** Derives the REST base and the site's slug prefix from its *-redirects endpoint URL. */
export function parseRedirectsApiUrl(
  redirectFetchUrl: unknown,
): { apiBase: string; slugPrefix: string } | null {
  const m = String(redirectFetchUrl).match(
    /^(https?:\/\/[^/]+)\/api\/([a-z0-9-]+)-redirects/i,
  );
  if (!m) return null;
  return { apiBase: m[1], slugPrefix: m[2] };
}

export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
  /** Optional: used to classify a failure. Absent ⇒ the failure is not classified. */
  status?: number;
  /** Optional: preferred over `json()` when reading an error body. */
  text?(): Promise<string>;
}>;

export interface SitemapNoIndexOptions {
  /** Defaults to DEFAULT_CONTENT_TYPES. */
  contentTypes?: readonly SitemapContentType[];
  /** Defaults to the global fetch. Injectable for tests. */
  fetch?: FetchLike;
}

export interface SitemapNoIndex {
  normalizeSitemapPath: typeof normalizeSitemapPath;
  /** Cached per redirects URL, so the transform hook can call it for every path. */
  getNoIndexPathSetPromise(redirectFetchUrl: string): Promise<Set<string>>;
}

export function createSitemapNoIndex(
  options: SitemapNoIndexOptions = {},
): SitemapNoIndex {
  const contentTypes = options.contentTypes ?? DEFAULT_CONTENT_TYPES;
  const doFetch: FetchLike = (url) =>
    options.fetch ? options.fetch(url) : globalThis.fetch(url);

  /**
   * Says something useful about a non-OK response, or stays quiet.
   *
   * Before 2.1 every non-OK was swallowed, which hid a real misconfiguration: a site whose
   * collection spells the field `slug` rather than `Slug` gets a 400 "Invalid key Slug"
   * and silently contributes nothing to the exclusion set. That case now speaks up.
   *
   * A response with no observable `status` is left silent, exactly as before — a failure
   * that cannot be classified must not become noise for every site that injects a fetch.
   */
  async function reportFailure(
    res: { ok: boolean; json(): Promise<unknown>; status?: number; text?(): Promise<string> },
    uid: string,
    field: string,
  ): Promise<void> {
    const { status } = res;
    if (status === undefined) return;
    // The collection does not exist on this site. Expected, and not worth a line.
    if (status === 404) return;

    if (status === 400) {
      let body = "";
      try {
        body = res.text
          ? await res.text()
          : JSON.stringify((await res.json()) ?? "");
      } catch {
        body = "";
      }
      // The collection exists but carries no `seo` component, so it can hold no noIndex.
      if (/Invalid key seo\b/i.test(body)) return;
      const invalidKey = body.match(/Invalid key ([A-Za-z0-9_]+)/i);
      if (invalidKey) {
        console.error(
          `[sitemap] ${uid}: Strapi rejected the query with "Invalid key ${invalidKey[1]}". The configured field for this collection is ${JSON.stringify(field)} — check its spelling and case. No paths were excluded for it.`,
        );
        return;
      }
      console.error(`[sitemap] ${uid}: Strapi returned HTTP 400. ${body}`);
      return;
    }

    console.error(`[sitemap] ${uid}: noIndex query failed with HTTP ${status}.`);
  }

  async function fetchNoIndexForUid(
    base: string,
    uid: string,
    field: string,
    pathPrefix: string | null,
  ): Promise<string[]> {
    const fieldParam = `fields%5B0%5D=${encodeURIComponent(field)}`;
    const url = `${base}/api/${uid}?${STRAPI_NOINDEX_FILTER}&${fieldParam}`;
    const paths: string[] = [];
    try {
      const res = await doFetch(url);
      if (!res.ok) {
        await reportFailure(res, uid, field);
        return paths;
      }
      const json = (await res.json()) as {
        data?: Array<Record<string, unknown> | null>;
      };
      for (const row of json.data || []) {
        const raw = row?.[field];
        if (!raw) continue;
        paths.push(
          pathPrefix != null
            ? normalizeSitemapPath(`${pathPrefix}/${raw}`)
            : normalizeSitemapPath(raw),
        );
      }
    } catch (e) {
      console.error(`[sitemap] noIndex fetch failed for ${uid}:`, e);
    }
    return paths;
  }

  async function buildNoIndexPathSet(
    redirectFetchUrl: string,
  ): Promise<Set<string>> {
    const parsed = parseRedirectsApiUrl(redirectFetchUrl);
    const paths = new Set<string>();
    if (!parsed) return paths;
    const { apiBase, slugPrefix } = parsed;

    const batches = await Promise.all(
      contentTypes.map((type) =>
        fetchNoIndexForUid(
          apiBase,
          `${slugPrefix}-${type.uid}`,
          type.field,
          type.prefix ?? null,
        ),
      ),
    );
    for (const arr of batches) {
      for (const p of arr) paths.add(p);
    }
    return paths;
  }

  const cache = new Map<string, Promise<Set<string>>>();

  function getNoIndexPathSetPromise(
    redirectFetchUrl: string,
  ): Promise<Set<string>> {
    let promise = cache.get(redirectFetchUrl);
    if (!promise) {
      promise = buildNoIndexPathSet(redirectFetchUrl);
      cache.set(redirectFetchUrl, promise);
    }
    return promise;
  }

  return { normalizeSitemapPath, getNoIndexPathSetPromise };
}
