import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "./siteConfig.js";

/**
 * Generates Next.js App Router metadata object from SEO data
 * @param {Object} seoData - SEO data from CMS
 * @param {string} path - Page path (e.g., "about" or "blog/post-slug")
 */
/**
 * Collapse a rich-text summary into something usable as a meta description.
 * CMS Excerpt/ShortText values carry newlines and run to ~350 chars.
 */
function summarise(text, max = 160) {
  if (typeof text !== "string") return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export function generateSEOMetadata(seoData, path, pageData) {
  const baseUrl = SITE_URL;

  const defaultTitle = SITE_TITLE;
  const defaultDescription = SITE_DESCRIPTION;

  // A page with no SEO record of its own still has a name — use it rather than the site
  // default, so each page gets a distinct title instead of repeating the homepage's.
  // The field differs by content type: Title (articles, sectors, galleries),
  // PageName (dynamic pages), Name (partners, speakers).
  const pageTitle = pageData?.Title || pageData?.PageName || pageData?.Name;
  const pageSummary = summarise(pageData?.Excerpt || pageData?.ShortText);

  const metaTitle = seoData?.metaTitle || pageTitle || defaultTitle;
  const metaDescription =
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

  const robots = noIndex
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
      locale: "en_US",
      type: "website",
      ...(imageUrl && {
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: metaTitle,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
      ...(imageUrl && { images: [imageUrl] }),
    },
    robots,
  };
}
