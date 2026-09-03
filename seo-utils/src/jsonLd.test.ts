import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getStructuredDataScriptInnerHtmls, JsonLd } from "./jsonLd.js";

describe("getStructuredDataScriptInnerHtmls", () => {
  it("returns nothing for empty input", () => {
    expect(getStructuredDataScriptInnerHtmls(null)).toEqual([]);
    expect(getStructuredDataScriptInnerHtmls(undefined)).toEqual([]);
    expect(getStructuredDataScriptInnerHtmls("")).toEqual([]);
    expect(getStructuredDataScriptInnerHtmls("   ")).toEqual([]);
    expect(getStructuredDataScriptInnerHtmls(42)).toEqual([]);
    expect(getStructuredDataScriptInnerHtmls(new Date())).toEqual([]);
  });
  it("parses a JSON string, tolerating a BOM and whitespace", () => {
    expect(getStructuredDataScriptInnerHtmls('\uFEFF  {"@type":"Event"} ')).toEqual(['{"@type":"Event"}']);
  });
  it("drops invalid JSON", () => {
    expect(getStructuredDataScriptInnerHtmls("{not json")).toEqual([]);
  });
  it("accepts an object or an array, keeping only object items", () => {
    expect(getStructuredDataScriptInnerHtmls({ a: 1 })).toEqual(['{"a":1}']);
    expect(getStructuredDataScriptInnerHtmls([{ a: 1 }, null, 3, "x", { b: 2 }])).toEqual(['{"a":1}', '{"b":2}']);
    expect(getStructuredDataScriptInnerHtmls('[{"a":1},{"b":2}]')).toEqual(['{"a":1}', '{"b":2}']);
  });
  it("escapes < so the payload cannot close the script tag", () => {
    expect(getStructuredDataScriptInnerHtmls({ x: "</script><b>" })).toEqual(['{"x":"\\u003c/script>\\u003cb>"}']);
  });
});

describe("JsonLd", () => {
  it("renders one ld+json script per payload", () => {
    const html = renderToStaticMarkup(createElement(JsonLd, { seo: { JSON_LD: [{ a: 1 }, { b: 2 }] } }));
    expect(html).toBe('<script type="application/ld+json">{"a":1}</script><script type="application/ld+json">{"b":2}</script>');
  });
  it("renders nothing when there is no payload", () => {
    expect(renderToStaticMarkup(createElement(JsonLd, { seo: null }))).toBe("");
    expect(renderToStaticMarkup(createElement(JsonLd, {}))).toBe("");
  });
});
