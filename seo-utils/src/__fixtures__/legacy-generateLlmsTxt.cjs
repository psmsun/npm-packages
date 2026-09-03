const fs = require("fs");

/**
 * Resolves a CMS link to an absolute URL.
 * Handles: absolute URLs, paths with leading slash, paths without leading slash.
 */
function resolveUrl(siteUrl, linkTo) {
  if (!linkTo) return null;
  if (linkTo.startsWith("http")) return linkTo;
  const path = linkTo.startsWith("/") ? linkTo : `/${linkTo}`;
  return `${siteUrl}${path}`;
}

/**
 * Generates llms.txt in the build output directory using SEO and NavBar data from Strapi.
 * Called as a side effect inside next-sitemap's additionalPaths hook.
 *
 * @param {object} opts
 * @param {string} opts.siteUrl            - e.g. "https://mosbuildexpo.com"
 * @param {string} opts.outDir             - e.g. "out"
 * @param {string} opts.strapiGraphqlUrl   - e.g. "https://ite-cms.prismetic.com/graphql"
 * @param {string} opts.homepageType       - Strapi GraphQL collection name, e.g. "mosBuildHomepage"
 * @param {string} opts.navBarType         - Strapi GraphQL collection name, e.g. "mosBuildNavBar"
 */
async function generateLlmsTxt({
  siteUrl,
  outDir,
  strapiGraphqlUrl,
  homepageType,
  navBarType,
}) {
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
    const res = await fetch(strapiGraphqlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const { data } = await res.json();

    const seo = data?.[homepageType]?.seo;
    const navItems = data?.[navBarType]?.Data ?? [];

    if (!seo?.metaTitle) {
      console.warn("[llms.txt] No SEO data found, skipping generation");
      return;
    }

    // Build grouped sections from nav structure.
    // Top-level items are dropdown headers (LinkTo is usually null),
    // so we use their Links[] as the actual page entries.
    const sectionBlocks = navItems
      .map((item) => {
        const lines = [];

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
          .filter(Boolean);

        if (subLinks.length > 0) {
          // Only add the section header if it has no direct link (pure dropdown)
          if (!topUrl) lines.push(`- ${item.Title}`);
          lines.push(...subLinks);
        }

        return lines.join("\n");
      })
      .filter(Boolean)
      .join("\n");

    const content = `# ${seo.metaTitle}
> ${seo.metaDescription}

## Key Sections

- Homepage: ${siteUrl}/
${sectionBlocks}
`;

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(`${outDir}/llms.txt`, content, "utf-8");
    console.log("[llms.txt] generated →", `${outDir}/llms.txt`);
  } catch (err) {
    console.error("[llms.txt] generation failed:", err.message);
  }
}

module.exports = { generateLlmsTxt };
