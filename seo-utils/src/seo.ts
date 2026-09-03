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
  /** Used when a page has neither an SEO record nor a name of its own. */
  siteTitle: string;
  /** Used when a page has neither an SEO record nor a summary of its own. */
  siteDescription: string;
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
  description: string;
  keywords: string | string[] | null | undefined;
  alternates: { canonical: string };
  openGraph: {
    title: string;
    description: string;
    url: string;
    siteName: string;
    locale: string;
    type: "website";
    images?: Array<{ url: string; width: number; height: number; alt: string }>;
  };
  twitter: {
    card: "summary_large_image";
    title: string;
    description: string;
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
 * speaker Content is rich-text HTML, so tags and entities are stripped.
 */
export function summarise(text: unknown, max = 160): string | null {
  if (typeof text !== "string") return null;
  const clean = text
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

export function createSeo(config: SeoConfig): {
  generateSEOMetadata: GenerateSEOMetadata;
} {
  const baseUrl = config.siteUrl.replace(/\/+$/, "");
  const defaultTitle = config.siteTitle;
  const defaultDescription = config.siteDescription;
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
    const pageTitle = pageData?.Name
      ? summarise(personTitle || pageData.Name, 60)
      : pageData?.Title || pageData?.PageName;
    // Speakers carry no summary field of their own (Details is a contact card), so the
    // name, job title and company stand in rather than the site-wide default.
    const personSummary =
      personTitle && pageData?.Company && pageData.Company !== pageData.Title
        ? `${personTitle}, ${pageData.Company}`
        : personTitle;
    const pageSummary = summarise(
      pageData?.Excerpt ||
        pageData?.ShortText ||
        pageData?.Content ||
        personSummary,
    );

    const metaTitle: string = seoData?.metaTitle || pageTitle || defaultTitle;
    const metaDescription: string =
      seoData?.metaDescription || pageSummary || defaultDescription;
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
    // A page with no SEO record of its own falls back to the homepage's SEO. That must
    // supply defaults only — never identity. Inheriting the homepage's canonical made the
    // page declare itself a duplicate of the homepage, which de-indexes it. So a canonical
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
      description: metaDescription,
      keywords: keywords,
      alternates: {
        canonical: canonical,
      },
      openGraph: {
        title: metaTitle,
        description: metaDescription,
        url: canonical,
        siteName: defaultTitle,
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
        description: metaDescription,
        ...(imageUrl ? { images: [imageUrl] } : {}),
      },
      robots,
    };
  };

  return { generateSEOMetadata };
}
