/**
 * Next.js App Router metadata built from Strapi SEO data.
 *
 * Extracted from the fleet's `lib/seo.js` — the variant that strips HTML from
 * summaries and puts a person's Name before their job Title. Site identity is
 * passed in through `createSeo`, so one implementation serves every site.
 */

export interface SeoConfig {
  /** Site origin, e.g. "https://expopharmtech.com". A trailing slash is stripped. */
  siteUrl: string;
  /** The event's name. Open Graph site name, and the last-resort page title. */
  siteName: string;
  /** Open Graph locale. Defaults to "en_US". */
  locale?: string;
}

/** The Strapi `seo` component as the sites query it. */
export interface CmsSeo {
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string | string[] | null;
  noIndex?: boolean | null;
  canonicalURL?: string | null;
  metaImage?: { url?: string | null } | null;
  [key: string]: unknown;
}

/**
 * The page record itself. Title / PageName / Name give the fallback title and
 * Excerpt / ShortText / Content the fallback description; shapes differ per
 * content type, so this stays loose on purpose.
 */
export type CmsPageData = Record<string, any> | null | undefined;

export interface SeoRobots {
  index: boolean;
  follow: boolean;
  googleBot: { index: boolean; follow: boolean };
}

/** Structurally assignable to Next's `Metadata`, so the package needs no `next` import. */
export interface SeoMetadata {
  title: { absolute: string };
  /** Omitted when the page has no summary of its own — never a site-wide filler. */
  description?: string;
  keywords: string | string[] | null | undefined;
  alternates: { canonical: string };
  openGraph: {
    title: string;
    description?: string;
    url: string;
    siteName: string;
    locale: string;
    type: "website";
    images?: Array<{ url: string; width: number; height: number; alt: string }>;
  };
  twitter: {
    card: "summary_large_image";
    title: string;
    description?: string;
    images?: string[];
  };
  robots: SeoRobots;
}

export type GenerateSEOMetadata = (
  seoData: CmsSeo | null | undefined,
  path?: string | null,
  pageData?: CmsPageData,
) => SeoMetadata;

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/**
 * Collapse a rich-text summary into something usable as a meta description.
 * CMS Excerpt/ShortText values carry newlines and run to ~350 chars; partner and
 * speaker Content is rich-text HTML, so tags and entities are stripped. <style> and
 * <script> blocks go first, inner text included — a page whose Content embeds a form
 * would otherwise describe itself with that form's CSS.
 */
export function summarise(text: unknown, max = 160): string | null {
  if (typeof text !== "string") return null;
  const clean = text
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity])
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/**
 * The first argument that is a usable string. CMS text fields are routinely saved as a
 * single space, which a plain `||` chain accepts as a value and then summarises to
 * nothing — so every source is trimmed before it is tested, not merely null-checked.
 */
function firstNonBlank(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

/**
 * A page Header.Title as a page title. Editors separate the two halves of a heading with
 * `//` ("Industry Insights // Hub"), which reads as a typo in a browser tab, and the cut
 * leaves a stray space in front of any punctuation that followed it. A `//` preceded by a
 * colon is left alone so a URL in a heading does not collapse to "https:".
 */
export function cleanHeaderTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value
    .replace(/(?<!:)\/\//g, " ")
    .replace(/\s+/g, " ")
    .replace(/ ([?!,.;:])/g, "$1")
    .trim();
  return clean || null;
}

export function createSeo(config: SeoConfig): {
  generateSEOMetadata: GenerateSEOMetadata;
} {
  const baseUrl = config.siteUrl.replace(/\/+$/, "");
  const siteName = config.siteName;
  const locale = config.locale ?? "en_US";

  const generateSEOMetadata: GenerateSEOMetadata = (seoData, path, pageData) => {
    // A page with no SEO record of its own still has a name — use it rather than the site
    // default, so each page gets a distinct title instead of repeating the homepage's.
    // The field differs by content type: Title (articles, sectors, galleries),
    // PageName (dynamic pages), Name (partners, speakers). On a speaker `Title` is the
    // job title, so Name leads and the job title is appended while the pair stays short.
    const personTitle =
      pageData?.Name && pageData?.Title
        ? `${pageData.Name} — ${pageData.Title}`
        : null;
    // Header.Title is the heading the page shows above the fold — a better title than the
    // PageName slug behind it, and the only page-specific one the 629 fleet pages with no
    // SEO record have at all.
    const pageTitle = pageData?.Name
      ? summarise(personTitle || pageData.Name, 60)
      : firstNonBlank(pageData?.Title) ||
        cleanHeaderTitle(pageData?.Header?.Title) ||
        firstNonBlank(pageData?.PageName);
    // Speakers carry no summary field of their own (Details is a contact card), so the
    // name, job title and company stand in rather than the site-wide default.
    const personSummary =
      personTitle && pageData?.Company && pageData.Company !== pageData.Title
        ? `${personTitle}, ${pageData.Company}`
        : personTitle;
    // Header.Content is the page's own intro paragraph, and it comes last: it is the
    // longest and the least edited, and on a speaker or partner the person themselves
    // describes the page better than the header above them does. A page with none gets no
    // description at all rather than the homepage's, which 629 fleet pages used to share.
    const pageSummary = summarise(
      firstNonBlank(
        pageData?.Excerpt,
        pageData?.ShortText,
        pageData?.Content,
        personSummary,
        pageData?.Header?.Content,
      ),
    );

    const metaTitle: string =
      firstNonBlank(seoData?.metaTitle) || pageTitle || siteName;
    // No site-wide fallback: a description that says nothing about the page is worse for
    // search than none, and Google writes a better one from the page than we can.
    const metaDescription: string | null =
      firstNonBlank(seoData?.metaDescription) || pageSummary;
    const keywords = seoData?.keywords;
    const noIndex = seoData?.noIndex ?? false;

    const metaImage = seoData?.metaImage;
    const imageUrl = metaImage?.url
      ? metaImage.url.startsWith("http")
        ? metaImage.url
        : `${baseUrl}${metaImage.url}`
      : null;

    let cleanPath = path ? path.trim() : "";
    cleanPath = cleanPath.replace(/^\/+|\/+$/g, "");

    const pathSegment = cleanPath ? `/${cleanPath}` : "";
    // A canonical is identity, so a page must never inherit one: declaring itself a
    // duplicate of the homepage de-indexes it. Sites that once filled the whole SEO record
    // from the homepage left that root canonical behind on real pages, so a canonical
    // pointing at the site root is ignored on any non-root path; deliberate per-page
    // canonicals (used to point one URL at another) still win.
    const cmsCanonical = seoData?.canonicalURL;
    const inheritedRootCanonical =
      !!pathSegment && cmsCanonical?.replace(/\/+$/, "") === baseUrl;
    const canonical =
      cmsCanonical && !inheritedRootCanonical
        ? cmsCanonical
        : `${baseUrl}${pathSegment}/`;

    const robots: SeoRobots = noIndex
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true },
        };

    return {
      title: {
        absolute: metaTitle,
      },
      ...(metaDescription ? { description: metaDescription } : {}),
      keywords: keywords,
      alternates: {
        canonical: canonical,
      },
      openGraph: {
        title: metaTitle,
        ...(metaDescription ? { description: metaDescription } : {}),
        url: canonical,
        siteName,
        locale,
        type: "website",
        ...(imageUrl
          ? {
              images: [
                {
                  url: imageUrl,
                  width: 1200,
                  height: 630,
                  alt: metaTitle,
                },
              ],
            }
          : {}),
      },
      twitter: {
        card: "summary_large_image",
        title: metaTitle,
        ...(metaDescription ? { description: metaDescription } : {}),
        ...(imageUrl ? { images: [imageUrl] } : {}),
      },
      robots,
    };
  };

  return { generateSEOMetadata };
}
