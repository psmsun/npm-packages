/**
 * llms.txt (llmstxt.org) from the homepage SEO record and the CMS navbar, written into the
 * static export next to sitemap.xml. Runs under plain Node in next-sitemap's
 * `additionalPaths` hook, after `next build`: each navbar link is checked against the
 * exported files, and any failure rejects so the build fails.
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import {
  attr,
  decodeAttribute,
  exportedFilesFor,
  headOf,
  inspectExportedHtml,
} from "./buildNoIndex.js";

/**
 * The subset of fetch this module uses; injectable for tests. Absent `ok`/`status` ⇒ the
 * response is not classified.
 */
export type PostFetchLike = (
  url: string,
  init: { method: "POST"; headers: Record<string, string>; body: string },
) => Promise<{ ok?: boolean; status?: number; json(): Promise<unknown> }>;

export interface LlmsTxtOptions {
  /** Site origin, e.g. "https://mosbuildexpo.com". A trailing slash is tolerated, a path is not. */
  siteUrl: string;
  /** The static export, e.g. "out". It must already hold index.html; llms.txt is written into it. */
  outDir: string;
  /** GraphQL endpoint, e.g. "https://ite-cms.prismetic.com/graphql". */
  strapiGraphqlUrl: string;
  /** Strapi GraphQL root of the homepage single type, e.g. "mosBuildHomepage". */
  homepageType: string;
  /** Strapi GraphQL root of the navbar single type, e.g. "mosBuildNavBar". */
  navBarType: string;
  /** How this site's navbar `NavText` (event date and location) is shaped; omit to leave it out. */
  navText?: "component" | "string";
  /** Defaults to the global fetch. */
  fetch?: PostFetchLike;
}

interface NavLink {
  Text?: string | null;
  LinkTo?: string | null;
}

interface NavItem {
  Title?: string | null;
  LinkTo?: string | null;
  Links?: NavLink[] | null;
}

interface Site {
  origin: string;
  outDir: string;
  root: string;
}

interface Exported {
  url: string;
  file: string;
  page: boolean;
}

const META_TAG = /<meta\b[^>]*>/gi;
const REFRESH_URL = /^\s*[\d.]+\s*[;,]?\s*(?:url\s*=\s*)?(['"]?)(.*?)\1\s*$/i;
const NAV_TEXT_QUERY = {
  component: `
      NavText {
        Text1
        Text2
      }`,
  string: `
      NavText`,
};

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function graphqlErrors(errors: unknown): string | null {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  return errors.map((e) => (typeof e?.message === "string" ? e.message : JSON.stringify(e))).join("; ");
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function decodePath(p: string): string {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

function siteOrigin(siteUrl: string): string {
  let url: URL | null;
  try {
    url = new URL(siteUrl);
  } catch {
    url = null;
  }
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:") || url.pathname !== "/") {
    throw new Error(
      `[llms.txt] siteUrl must be an http(s) origin such as "https://example.com", got ${JSON.stringify(siteUrl)}.`,
    );
  }
  return url.origin;
}

function isExportedFile(site: Site, file: string): boolean {
  if (relative(site.root, resolve(file)).startsWith(`..${sep}`) || file.includes("\0")) return false;
  try {
    return statSync(file).isFile();
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR" || code === "ENAMETOOLONG") return false;
    throw new Error(`[llms.txt] Could not read ${file}: ${messageOf(e)}`);
  }
}

function readExported(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch (e) {
    throw new Error(`[llms.txt] Could not read ${file}: ${messageOf(e)}`);
  }
}

function exported(site: Site, pathname: string): Exported | null {
  const p = pathname.replace(/^\/+|\/+$/g, "");
  const at = (path: string) => `${site.origin}/${path.replace(/\(/g, "%28").replace(/\)/g, "%29")}`;
  const files = exportedFilesFor(pathname, site.outDir);
  const i = files.findIndex((file) => isExportedFile(site, file));
  // exportedFilesFor lists p/index.html, then p.html, for each spelling of p.
  if (i !== -1) return { url: at(i % 2 === 0 && p ? `${p}/` : p), file: files[i], page: true };
  const file = join(site.outDir, decodePath(p));
  return isExportedFile(site, file) ? { url: at(p), file, page: file.endsWith(".html") } : null;
}

function refreshTarget(html: string): string | null {
  for (const tag of headOf(html).match(META_TAG) ?? []) {
    if (attr(tag, "http-equiv")?.trim().toLowerCase() !== "refresh") continue;
    return REFRESH_URL.exec(decodeAttribute(attr(tag, "content") ?? ""))?.[2] || null;
  }
  return null;
}

/** The URL llms.txt lists for one link, or null when the link is dropped. */
function listable(
  site: Site,
  href: string,
  base: string,
  label: string,
  via: string | null,
): string | null {
  const name = JSON.stringify(label);
  const from = via === null ? "" : ` (redirect from ${via})`;
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    console.error(`[llms.txt] Dropping ${name} --> ${JSON.stringify(href)}${from}: not a valid URL.`);
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    console.log(`[llms.txt] Ignoring non-http link ${name} --> ${url.href}${from}`);
    return null;
  }
  if (url.origin !== site.origin) {
    console.log(`[llms.txt] Ignoring external link ${name} --> ${url.href}${from}`);
    return null;
  }
  const hit = exported(site, url.pathname);
  if (!hit) {
    console.error(`[llms.txt] Dropping ${name} --> ${url.href}${from}: not in the export.`);
    return null;
  }
  if (!hit.page) return hit.url;
  const html = readExported(hit.file);
  const page = inspectExportedHtml(html);
  if (page.noIndex) {
    console.log(`[llms.txt] Ignoring noindex link ${name} --> ${hit.url}${from}`);
    return null;
  }
  if (!page.redirect) return hit.url;
  if (via !== null) {
    console.error(`[llms.txt] Dropping ${name} --> ${via}: it redirects to ${hit.url}, which redirects again.`);
    return null;
  }
  const target = refreshTarget(html);
  if (target === null) {
    console.error(`[llms.txt] Dropping ${name} --> ${hit.url}: its refresh has no readable URL.`);
    return null;
  }
  return listable(site, target, hit.url, label, hit.url);
}

function navTextLines(shape: "component" | "string", value: any): string[] {
  const texts: unknown[] = shape === "component" ? [value?.Text1, value?.Text2] : [value];
  return texts
    .filter((text): text is string => typeof text === "string")
    .flatMap((text) => text.split(/\r\n|\r|\n/))
    .map(clean)
    .filter((line) => line !== "");
}

function candidates(nav: unknown[]): Array<{ text: unknown; href: unknown }> {
  const out: Array<{ text: unknown; href: unknown }> = [];
  for (const item of nav as Array<NavItem | null>) {
    out.push({ text: item?.Title, href: item?.LinkTo });
    const links = item?.Links;
    if (!Array.isArray(links)) continue;
    for (const link of links as Array<NavLink | null>) out.push({ text: link?.Text, href: link?.LinkTo });
  }
  return out;
}

/**
 * Writes `<outDir>/llms.txt` from the homepage SEO title and description, the navbar's
 * `NavText` when `navText` is set, and the navbar links the export can serve. Rejects on
 * any failure; see the README for the rules.
 */
export async function generateLlmsTxt({
  siteUrl,
  outDir,
  strapiGraphqlUrl,
  homepageType,
  navBarType,
  navText,
  fetch: fetchImpl,
}: LlmsTxtOptions): Promise<void> {
  const site: Site = { origin: siteOrigin(siteUrl), outDir, root: resolve(outDir) };
  if (navText !== undefined && navText !== "component" && navText !== "string") {
    const got: unknown = navText;
    throw new Error(
      `[llms.txt] navText must be "component" or "string", got ${typeof got === "string" ? JSON.stringify(got) : String(got)}.`,
    );
  }
  const home = join(outDir, "index.html");
  if (!isExportedFile(site, home)) {
    throw new Error(`[llms.txt] ${home} does not exist. Generate llms.txt after next build has exported the site.`);
  }

  const query = `query {
    ${homepageType} {
      seo {
        metaTitle
        metaDescription
      }
    }
    ${navBarType} {
      Data {
        Title
        LinkTo
        Links {
          Text
          LinkTo
        }
      }${navText === undefined ? "" : NAV_TEXT_QUERY[navText]}
    }
  }`;

  const doFetch: PostFetchLike = fetchImpl ?? globalThis.fetch;
  let res: Awaited<ReturnType<PostFetchLike>>;
  try {
    res = await doFetch(strapiGraphqlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
  } catch (e) {
    throw new Error(`[llms.txt] CMS request to ${strapiGraphqlUrl} failed: ${messageOf(e)}`);
  }
  if (res.ok === false) {
    const status = res.status === undefined ? "" : ` with HTTP ${res.status}`;
    let reason: string | null;
    try {
      reason = graphqlErrors(((await res.json()) as { errors?: unknown } | null)?.errors);
    } catch {
      // An error page need not be JSON; the status alone is the reason then.
      reason = null;
    }
    throw new Error(`[llms.txt] CMS request to ${strapiGraphqlUrl} failed${status}${reason === null ? "." : `: ${reason}`}`);
  }
  let body: { data?: Record<string, any> | null; errors?: unknown } | null;
  try {
    body = (await res.json()) as typeof body;
  } catch (e) {
    throw new Error(`[llms.txt] CMS response from ${strapiGraphqlUrl} is not JSON: ${messageOf(e)}`);
  }

  const errors = graphqlErrors(body?.errors);
  if (errors !== null) throw new Error(`[llms.txt] CMS answered with GraphQL errors: ${errors}`);
  const seo = body?.data?.[homepageType]?.seo;
  const title = clean(seo?.metaTitle);
  if (!title) {
    throw new Error(`[llms.txt] The CMS returned no ${homepageType}.seo.metaTitle; llms.txt needs the homepage SEO title.`);
  }
  const navBar = body?.data?.[navBarType];
  const nav: unknown = navBar?.Data;
  if (!Array.isArray(nav)) {
    throw new Error(`[llms.txt] The CMS returned no ${navBarType}.Data list; llms.txt needs the navbar.`);
  }
  const event = navText === undefined ? [] : navTextLines(navText, navBar?.NavText);
  if (navText !== undefined && event.length === 0) {
    console.error(`[llms.txt] The CMS returned no ${navBarType}.NavText text; llms.txt is written without the event date and location.`);
  }

  const seen = new Set<string>();
  const lines: string[] = [];
  for (const { text, href } of candidates(nav)) {
    if (typeof href !== "string" || !href.trim()) continue;
    const label = clean(text);
    const url = listable(site, href.trim(), `${site.origin}/`, label, null);
    if (url === null || seen.has(url)) continue;
    seen.add(url);
    lines.push(`- [${(label || url).replace(/[\\[\]]/g, "\\$&")}](${url})`);
  }

  const file = `${outDir}/llms.txt`;
  const blocks = [`# ${title}`];
  const description = clean(seo?.metaDescription);
  if (description) blocks.push(`> ${description}`);
  if (event.length > 0) blocks.push(event.map((line) => `- ${line}`).join("\n"));
  if (lines.length > 0) {
    blocks.push(`## Pages\n\n${lines.join("\n")}`);
  } else {
    console.error(`[llms.txt] ${file} has no links: no navbar entry points at a listable page.`);
  }
  try {
    writeFileSync(file, `${blocks.join("\n\n")}\n`, "utf-8");
  } catch (e) {
    throw new Error(`[llms.txt] Could not write ${file}: ${messageOf(e)}`);
  }
  console.log("[llms.txt] generated →", `${outDir}/llms.txt`);
}
