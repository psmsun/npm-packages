/**
 * The `./bilingual` entry must reproduce the four live Red Sea sites, not merely satisfy its own
 * tests. Each golden holds 270 `generateSEOMetadata` cases and 10 `resolvePageSeo` cases
 * captured from that repo's pre-package `lib/seo.(js|ts)`.
 *
 * Every case must match EXCEPT the reviewed delta list below. A case that moves for any
 * other reason fails here, and a case in the delta list that does NOT move fails too —
 * otherwise the list quietly grows into a licence to differ.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import daraahGolden from "./__fixtures__/redsea/daraah.golden.json" with {
  type: "json",
};
import desertrockGolden from "./__fixtures__/redsea/desertrock.golden.json" with {
  type: "json",
};
import shebaraGolden from "./__fixtures__/redsea/shebara.golden.json" with {
  type: "json",
};
import {
  type RedSeaRepo,
  RED_SEA_SITES,
} from "./__fixtures__/redsea/siteConfigs.js";
import turtlebayGolden from "./__fixtures__/redsea/turtlebay.golden.json" with {
  type: "json",
};
import { createBilingualSeo } from "./bilingual.js";

interface GoldenCase {
  fixture: number;
  fixtureLabel: string;
  locale: string;
  path: string;
  metadata: Record<string, any> | null;
  error: string | null;
  console: string[];
}

interface GoldenInheritance {
  label: string;
  locale: string;
  homepageLoaderCalls: number;
  resolved: Record<string, unknown> | null;
  resolvedIsUndefined: boolean;
}

interface Golden {
  repo: string;
  siteBase: string;
  cases: GoldenCase[];
  inheritance: GoldenInheritance[];
  homepageSeoFixture: Record<string, unknown>;
}

const GOLDENS: Record<RedSeaRepo, Golden> = {
  turtlebay: turtlebayGolden as unknown as Golden,
  daraah: daraahGolden as unknown as Golden,
  desertrock: desertrockGolden as unknown as Golden,
  shebara: shebaraGolden as unknown as Golden,
};

const CONFIGURED_LOCALES = ["en", "ar"];

/**
 * The reviewed delta list, as decided by seo-final-review on 2026-09-08. A live CMS probe
 * of all four sites (both locales, single types and collections) found zero records that
 * hit any of these, so none of them moves a shipped page — they move synthetic fixtures.
 */
function expectedDeltaReasons(c: GoldenCase): string[] {
  const reasons: string[] = [];
  // 1. An http:// canonical on an https site is now rejected, never silently upgraded.
  if (c.fixture === 11) reasons.push("http canonical rejected");
  // 2. metaRobots "noindex, follow" keeps follow instead of collapsing to nofollow.
  if (c.fixture === 16) reasons.push("follow preserved");
  // 3. A whitespace-only metaTitle counts as absent, as it already did on ITE.
  if (c.fixture === 18) reasons.push("blank title falls back");
  // 4. An unconfigured locale is clamped to locales.default instead of building a URL
  //    for a page that cannot exist.
  if (!CONFIGURED_LOCALES.includes(c.locale)) reasons.push("unknown locale clamped");
  // 5. Any configured locale prefix is stripped from the path, not just the current one.
  const head = c.path.replace(/^\/+/, "").split("/")[0];
  if (CONFIGURED_LOCALES.includes(head) && head !== c.locale) {
    reasons.push("locale prefix stripped");
  }
  return reasons;
}

/** Sanitizer logs moved from console.warn to console.error; the text is unchanged. */
function messagesOnly(lines: string[]): string[] {
  return lines.map((l) => l.replace(/^(log|warn|error): /, ""));
}

describe.each(Object.keys(GOLDENS) as RedSeaRepo[])(
  "%s — golden parity with the pre-package implementation",
  (repo) => {
    const golden = GOLDENS[repo];
    const config = RED_SEA_SITES[repo];

    let logged: string[] = [];
    beforeEach(() => {
      logged = [];
      vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
        logged.push(`error: ${a.join(" ")}`);
      });
      vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => {
        logged.push(`warn: ${a.join(" ")}`);
      });
    });
    afterEach(() => vi.restoreAllMocks());

    it("the golden was captured from this repo at this site URL", () => {
      expect(golden.repo).toBe(repo);
      expect(golden.siteBase).toBe(config.siteUrl);
      expect(golden.cases).toHaveLength(270);
    });

    it("reproduces every case that is not in the reviewed delta list", () => {
      const seo = createBilingualSeo(config);
      const unexpected: string[] = [];
      let matched = 0;

      for (const c of golden.cases) {
        if (expectedDeltaReasons(c).length > 0) continue;
        logged = [];
        const actual = seo.forLocale(c.locale).generateSEOMetadata(
          c.metadata === null ? undefined : (findFixtureSeo(golden, c) as any),
          c.path,
        );
        try {
          expect(actual).toEqual(c.metadata);
          expect(messagesOnly(logged)).toEqual(messagesOnly(c.console));
          matched += 1;
        } catch (e) {
          unexpected.push(
            `fixture ${c.fixture} (${c.fixtureLabel}) locale=${c.locale} path=${JSON.stringify(c.path)}: ${(e as Error).message}`,
          );
        }
      }

      expect(unexpected).toEqual([]);
      // Pinned, not a lower bound: if the delta predicate ever widens, the number of cases
      // actually being compared drops and this fails instead of passing vacuously.
      expect(matched).toBe(120);
    });

    it("the delta list is exactly 150 of the 270 cases, and 147 of them move", () => {
      const seo = createBilingualSeo(config);
      const listed = golden.cases.filter(
        (c) => expectedDeltaReasons(c).length > 0,
      );
      expect(listed).toHaveLength(150);

      const unmoved: string[] = [];
      const movedByReason = new Map<string, number>();

      for (const c of listed) {
        logged = [];
        const actual = seo
          .forLocale(c.locale)
          .generateSEOMetadata(findFixtureSeo(golden, c) as any, c.path);
        const same =
          JSON.stringify(sortDeep(actual)) ===
          JSON.stringify(sortDeep(c.metadata));
        if (same) {
          unmoved.push(
            `fixture ${c.fixture} locale=${c.locale} path=${JSON.stringify(c.path)}`,
          );
        } else {
          for (const r of expectedDeltaReasons(c)) {
            movedByReason.set(r, (movedByReason.get(r) ?? 0) + 1);
          }
        }
      }

      // Fixture 3 is the only fixture carrying a canonical that survives sanitising. On an
      // unconfigured locale its output is unchanged: the CMS canonical overrides the URL
      // the clamp would have built, and title/description had already fallen back to
      // English. Clamping is still correct — there is simply nothing left for it to move.
      expect(unmoved).toEqual([
        'fixture 3 locale=fr path=""',
        'fixture 3 locale=fr path="dining"',
        'fixture 3 locale=fr path="meetings/enquire-form"',
      ]);
      expect(listed.length - unmoved.length).toBe(147);

      // Every reason on the list earns its place.
      expect([...movedByReason.keys()].sort()).toEqual([
        "blank title falls back",
        "follow preserved",
        "http canonical rejected",
        "locale prefix stripped",
        "unknown locale clamped",
      ]);
    });

    it("resolvePageSeo matches the golden inheritance cases", async () => {
      const homepageSeo = golden.homepageSeoFixture;
      let calls = 0;
      const seo = createBilingualSeo({
        ...config,
        loadHomepageSeo: async () => {
          calls += 1;
          return homepageSeo;
        },
      });

      for (const c of golden.inheritance) {
        if (c.label === "page seo undefined + homepage undefined") continue;
        calls = 0;
        const pageSeo =
          c.label === "page seo undefined"
            ? undefined
            : c.label === "page seo {}"
              ? {}
              : fixtureThree(golden);
        const resolved = await seo.forLocale(c.locale).resolvePageSeo(pageSeo);
        expect(resolved ?? null).toEqual(c.resolved);
        expect(calls).toBe(c.homepageLoaderCalls);
      }
    });

    it("inherits nothing when the homepage has no seo", async () => {
      const seo = createBilingualSeo({ ...config, loadHomepageSeo: async () => undefined });
      await expect(seo.forLocale("en").resolvePageSeo(undefined)).resolves.toBeUndefined();
    });

    it("never inherits canonicalURL, JSON_LD, noIndex or keywords", async () => {
      const seo = createBilingualSeo({
        ...config,
        loadHomepageSeo: async () => golden.homepageSeoFixture,
      });
      const resolved = await seo.forLocale("en").resolvePageSeo(undefined);
      expect(Object.keys(resolved ?? {}).sort()).toEqual([
        "metaDescription",
        "metaImage",
        "metaTitle",
      ]);
    });
  },
);

/** Stable key order, matching how the goldens were serialised. */
function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = sortDeep((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

/** The 18 CMS fixtures, rebuilt from the matrix the goldens were captured with. */
function seoFixtures(siteBase: string): Array<unknown> {
  return [
    undefined,
    {},
    {
      metaTitle: "Fixture Title",
      metaDescription: "Fixture description.",
      keywords: "a, b",
      metaImage: { url: "/uploads/x.jpg" },
      canonicalURL: `${siteBase}/en/dining/`,
      JSON_LD: '{"@type":"Hotel"}',
      noIndex: false,
    },
    { metaImage: { url: "http://cdn.example.com/z.jpg" } },
    { metaImage: { data: { attributes: { url: "/uploads/y.jpg" } } } },
    { metaImage: { data: null } },
    {
      metaImage: {
        data: { attributes: { formats: { large: { url: "/uploads/l.jpg" } } } },
      },
    },
    { canonicalURL: "/about" },
    { canonicalURL: "seoteam@acronym.com" },
    { canonicalURL: "https://example.com/x" },
    { canonicalURL: `${siteBase.replace(/^https:/, "http:")}/en/dining/` },
    { canonicalURL: " " },
    { noIndex: true },
    { noIndex: 1 },
    { noIndex: "yes" },
    { metaRobots: "noindex, follow" },
    { keywords: "" },
    { metaTitle: "   " },
  ];
}

function findFixtureSeo(golden: Golden, c: GoldenCase): unknown {
  return seoFixtures(golden.siteBase)[c.fixture - 1];
}

function fixtureThree(golden: Golden): unknown {
  return seoFixtures(golden.siteBase)[2];
}
