import { describe, expectTypeOf, it } from "vitest";
import { alternatesFromLocalizations } from "./localized.js";

interface Localization {
  locale: string;
  publishedAt?: string | null;
  Slug: string;
}

describe("alternatesFromLocalizations types", () => {
  it("accepts an any argument and reads any field on it", () => {
    const page: any = {};
    const alternates = alternatesFromLocalizations(page.localizations, (l) => `articles/${l.Slug}`);
    expectTypeOf(alternates).toEqualTypeOf<Record<string, string>>();
  });

  it("accepts an any[] argument", () => {
    const rows: any[] = [];
    alternatesFromLocalizations(rows, (l) => l.PagePath);
  });

  it("reads a known field on a typed array", () => {
    const rows = [{ locale: "zh-CN", publishedAt: "2026-09-29", Slug: "b" }];
    alternatesFromLocalizations(rows, (l) => {
      expectTypeOf(l).toEqualTypeOf<{ locale: string; publishedAt: string; Slug: string }>();
      return `articles/${l.Slug}`;
    });
  });

  it("rejects an unknown field on a typed array", () => {
    const rows = [{ locale: "zh-CN", publishedAt: "2026-09-29", Slug: "b" }];
    // @ts-expect-error PagePath is not a field of these rows
    alternatesFromLocalizations(rows, (l) => l.PagePath);
  });

  it("accepts an interface row type without an index signature", () => {
    const rows: Localization[] = [];
    alternatesFromLocalizations(rows, (l) => {
      expectTypeOf(l).toEqualTypeOf<Localization>();
      return l.Slug;
    });
  });

  it("accepts null and undefined", () => {
    alternatesFromLocalizations(null, () => "");
    alternatesFromLocalizations(undefined, () => "");
  });
});
