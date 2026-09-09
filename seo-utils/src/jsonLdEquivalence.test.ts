/**
 * The package's JsonLd must render exactly what the Red Sea repos render today.
 *
 * `__fixtures__/redsea/legacy-jsonLd.tsx` is a byte-identical copy of shebara's
 * `lib/jsonLd.tsx` (2026-09-08). desertrock's copy is byte-identical to it, and
 * turtlebay's / daraah's `.jsx` differ only in type annotations, so one fixture covers
 * all four.
 *
 * The pure helper is character-for-character the same in both, which is exactly why it is
 * worth pinning: the one real difference is how the component reads its prop — the package
 * uses `seo?.JSON_LD`, Red Sea guards with `"JSON_LD" in seo` — and that difference must
 * not be observable.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getStructuredDataScriptInnerHtmls as legacyHtmls,
  JsonLd as LegacyJsonLd,
} from "./__fixtures__/redsea/legacy-jsonLd.js";
import { getStructuredDataScriptInnerHtmls, JsonLd } from "./jsonLd.js";

const RAW_VALUES: Array<[string, unknown]> = [
  ["null", null],
  ["undefined", undefined],
  ["empty string", ""],
  ["whitespace string", "   "],
  ["BOM + padded JSON object", '\uFEFF  {"@type":"Event"} '],
  ["JSON string", '{"@type":"Hotel","name":"Shebara"}'],
  ["JSON array string", '[{"a":1},{"b":2}]'],
  ["invalid JSON", "{not json"],
  ["truncated JSON", '{"@type":'],
  ["JSON string that parses to a number", "42"],
  ["JSON string that parses to null", "null"],
  ["object", { "@type": "Resort" }],
  ["array with non-objects mixed in", [{ a: 1 }, null, 3, "x", { b: 2 }]],
  ["empty array", []],
  ["number", 42],
  ["boolean", true],
  ["Date", new Date("2026-09-08T00:00:00Z")],
  ["nested object", { "@type": "Hotel", address: { "@type": "PostalAddress" } }],
  ["payload containing </script>", { x: "</script><b>" }],
  ["payload containing < and >", { x: "a < b > c" }],
  ["payload with unicode", { name: "شيبارا" }],
];

describe("getStructuredDataScriptInnerHtmls matches the Red Sea implementation", () => {
  it.each(RAW_VALUES)("%s", (_label, raw) => {
    expect(getStructuredDataScriptInnerHtmls(raw)).toEqual(legacyHtmls(raw));
  });
});

describe("JsonLd renders identically to the Red Sea component", () => {
  const SEO_SHAPES: Array<[string, unknown]> = [
    ...RAW_VALUES.map(
      ([label, raw]) => [`seo.JSON_LD = ${label}`, { JSON_LD: raw }] as [string, unknown],
    ),
    ["seo null", null],
    ["seo undefined", undefined],
    ["seo without a JSON_LD key", { metaTitle: "x" }],
    ["seo is a string", "not an object"],
    ["seo is a number", 7],
  ];

  it.each(SEO_SHAPES)("%s", (_label, seo) => {
    const ours = renderToStaticMarkup(
      createElement(JsonLd, { seo: seo as never }),
    );
    const theirs = renderToStaticMarkup(
      createElement(LegacyJsonLd, { seo: seo as never }),
    );
    expect(ours).toBe(theirs);
  });

  it("still escapes < so a payload cannot close the script tag", () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, { seo: { JSON_LD: { x: "</script><b>" } } }),
    );
    expect(html).not.toContain("</script><b>");
    expect(html).toContain("\\u003c/script>");
  });
});
