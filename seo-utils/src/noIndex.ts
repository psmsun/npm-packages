/**
 * How a CMS `seo` record says "keep this page out of the index".
 *
 * Shared by `./bilingual` and `./bilingual/sitemap` on purpose: the sitemap must exclude
 * exactly the pages that render `<meta name="robots" content="noindex">`. When the two
 * disagree, a noindex page stays in the sitemap and nothing reports it.
 *
 * The main entry uses it only when a site opts in with `noIndexPolicy: "strict"`. Its
 * default stays `seo.noIndex ?? false`, the loose truthy test the 27 ITE sites ship —
 * which reads the string "false" as noindex and ignores `metaRobots`. Both are wrong;
 * switching a site to strict changes which of its pages are indexed, so it is a per-site
 * decision taken after a CMS audit, not a default.
 */

export interface NoIndexVerdict {
  noIndex: boolean;
  /** Only meaningful when `noIndex` is true. `metaRobots: "noindex, follow"` keeps follow. */
  follow: boolean;
}

const INDEXED: NoIndexVerdict = { noIndex: false, follow: true };

/**
 * Accepts `true`, `1` and the strings `"true" | "1" | "yes"`; treats any other non-empty
 * string as an explicit negative; otherwise falls back to `metaRobots` / `robots`.
 *
 * Two things this deliberately does NOT do, both of which the loose `noIndex ?? false`
 * test on the main entry gets wrong: it does not read the string `"false"` as noindex, and
 * it does not ignore `metaRobots`.
 */
export function parseNoIndex(seo: unknown): NoIndexVerdict {
  if (!seo || typeof seo !== "object") return INDEXED;
  const record = seo as Record<string, unknown>;

  if (record.noIndex === true || record.NoIndex === true) {
    return { noIndex: true, follow: false };
  }
  const value = record.noIndex;
  if (value === 1) return { noIndex: true, follow: false };
  if (typeof value === "string" && value.trim() !== "") {
    if (/^(true|1|yes)$/i.test(value.trim())) {
      return { noIndex: true, follow: false };
    }
    // An explicit negative ("false", "no", "0") is an answer; do not fall through to
    // metaRobots and let a stale robots string override what the editor just said.
    return INDEXED;
  }

  const robots =
    record.metaRobots ?? record.meta_robots ?? record.robots ?? record.MetaRobots;
  if (typeof robots === "string" && /noindex/i.test(robots)) {
    // "noindex, follow" is a real and useful directive: drop the page but keep crawling
    // its links. Collapsing it to nofollow, as the fleet does today, loses that.
    return { noIndex: true, follow: !/nofollow/i.test(robots) };
  }
  return INDEXED;
}
