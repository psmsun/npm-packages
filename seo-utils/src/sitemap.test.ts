import { describe, expect, it } from "vitest";
import { normalizeSitemapPath } from "./sitemap.js";

describe("normalizeSitemapPath", () => {
  it.each([
    [null, "/"],
    [undefined, "/"],
    ["", "/"],
    ["/", "/"],
    ["   ", "/"],
    ["about", "/about"],
    ["/about/", "/about"],
    ["about///", "/about"],
    ["  /a/b/ ", "/a/b"],
    [42, "/42"],
  ])("%j → %s", (input, expected) => {
    expect(normalizeSitemapPath(input)).toBe(expected);
  });
});
