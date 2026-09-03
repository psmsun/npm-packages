/**
 * llms.txt (llmstxt.org) built from the site's homepage SEO record and NavBar, written
 * into the static export next to sitemap.xml. Called as a side effect inside
 * next-sitemap's `additionalPaths` hook, so it runs under plain Node after `next build`.
 *
 * Behaviour-neutral port of the Mosbuild `lib/generateLlmsTxt.js`: same query, same
 * output byte for byte, same console messages. A CMS failure is logged and swallowed,
 * so the deploy then simply has NO llms.txt — a known limitation kept on purpose so the
 * sitemap step never fails a build.
 */
import { mkdirSync, writeFileSync } from "node:fs";

/** The subset of fetch this module uses; injectable for tests. */
export type PostFetchLike = (
  url: string,
  init: { method: "POST"; headers: Record<string, string>; body: string },
) => Promise<{ json(): Promise<unknown> }>;

export interface LlmsTxtOptions {
  /** Site origin without a trailing slash, e.g. "https://mosbuildexpo.com". */
  siteUrl: string;
  /** Export directory the file is written into, e.g. "out". */
  outDir: string;
  /** GraphQL endpoint, e.g. "https://ite-cms.prismetic.com/graphql". */
  strapiGraphqlUrl: string;
  /** Strapi GraphQL root of the homepage single type, e.g. "mosBuildHomepage". */
  homepageType: string;
  /** Strapi GraphQL root of the navbar single type, e.g. "mosBuildNavBar". */
  navBarType: string;
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

/**
 * Resolves a CMS link to an absolute URL.
 * Handles: absolute URLs, paths with leading slash, paths without leading slash.
 */
function resolveUrl(
  siteUrl: string,
  linkTo: string | null | undefined,
): string | null {
  if (!linkTo) return null;
  if (linkTo.startsWith("http")) return linkTo;
  const path = linkTo.startsWith("/") ? linkTo : `/${linkTo}`;
  return `${siteUrl}${path}`;
}

/**
 * Generates `<outDir>/llms.txt` from the homepage SEO title/description and the navbar.
 * Never throws: a missing SEO record warns and skips, any other failure is logged.
 */
export async function generateLlmsTxt({
  siteUrl,
  outDir,
  strapiGraphqlUrl,
  homepageType,
  navBarType,
  fetch: fetchImpl,
}: LlmsTxtOptions): Promise<void> {
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
      }
    }
  }`;

  try {
    const doFetch: PostFetchLike = fetchImpl ?? globalThis.fetch;
    const res = await doFetch(strapiGraphqlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const { data } = (await res.json()) as {
      data?: Record<string, any> | null;
    };

    const seo = data?.[homepageType]?.seo;
    const navItems: NavItem[] = data?.[navBarType]?.Data ?? [];

    if (!seo?.metaTitle) {
      console.warn("[llms.txt] No SEO data found, skipping generation");
      return;
    }

    // Build grouped sections from nav structure.
    // Top-level items are dropdown headers (LinkTo is usually null),
    // so we use their Links[] as the actual page entries.
    const sectionBlocks = navItems
      .map((item) => {
        const lines: string[] = [];

        // If the top-level item has a direct link, include it
        const topUrl = resolveUrl(siteUrl, item.LinkTo);
        if (topUrl) {
          lines.push(`- ${item.Title}: ${topUrl}`);
        }

        // Add sub-links
        const subLinks = (item.Links ?? [])
          .map((link) => {
            const url = resolveUrl(siteUrl, link.LinkTo);
            return url ? `  - ${link.Text}: ${url}` : null;
          })
          .filter((line): line is string => Boolean(line));

        if (subLinks.length > 0) {
          // Only add the section header if it has no direct link (pure dropdown)
          if (!topUrl) lines.push(`- ${item.Title}`);
          lines.push(...subLinks);
        }

        return lines.join("\n");
      })
      .filter((block) => Boolean(block))
      .join("\n");

    const content = `# ${seo.metaTitle}
> ${seo.metaDescription}

## Key Sections

- Homepage: ${siteUrl}/
${sectionBlocks}
`;

    mkdirSync(outDir, { recursive: true });
    writeFileSync(`${outDir}/llms.txt`, content, "utf-8");
    console.log("[llms.txt] generated →", `${outDir}/llms.txt`);
  } catch (err) {
    console.error("[llms.txt] generation failed:", (err as Error).message);
  }
}
