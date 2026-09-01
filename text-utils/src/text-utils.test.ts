import { describe, expect, it } from "vitest";
import { parseMarkdownLinks } from "./parseMarkdownLinks.js";

describe("parseMarkdownLinks", () => {
  it("splits text around a link", () => {
    expect(parseMarkdownLinks("See [the programme](/programme) today")).toEqual([
      { type: "text", value: "See " },
      { type: "link", label: "the programme", href: "/programme", offset: 4 },
      { type: "text", value: " today" },
    ]);
  });

  it("returns a single text token when there are no links", () => {
    expect(parseMarkdownLinks("Just plain copy")).toEqual([
      { type: "text", value: "Just plain copy" },
    ]);
  });

  it("handles a link at the very start and the very end", () => {
    expect(parseMarkdownLinks("[a](/a) middle [b](/b)")).toEqual([
      { type: "link", label: "a", href: "/a", offset: 0 },
      { type: "text", value: " middle " },
      { type: "link", label: "b", href: "/b", offset: 15 },
    ]);
  });

  it("handles a string that is nothing but a link", () => {
    expect(parseMarkdownLinks("[a](/a)")).toEqual([
      { type: "link", label: "a", href: "/a", offset: 0 },
    ]);
  });

  it("preserves newlines so whitespace-pre-line still breaks lines", () => {
    const tokens = parseMarkdownLinks("line one\nline [two](/2)\nline three");
    expect(tokens[0]).toEqual({ type: "text", value: "line one\nline " });
    expect(tokens[2]).toEqual({ type: "text", value: "\nline three" });
  });

  it("passes every href through untouched — no URL logic here", () => {
    const hrefs = [
      "/programme",
      "programme",
      "itegroup.com",
      "https://itegroup.com",
      "mailto:a@b.com",
      "tel:+441234",
      "#speakers",
      "/brochure.pdf",
      "/https://itegroup.com",
    ];
    for (const href of hrefs) {
      const [token] = parseMarkdownLinks(`[x](${href})`);
      expect(token).toEqual({ type: "link", label: "x", href, offset: 0 });
    }
  });

  it("returns no tokens for empty or non-string input", () => {
    expect(parseMarkdownLinks("")).toEqual([]);
    expect(parseMarkdownLinks(null)).toEqual([]);
    expect(parseMarkdownLinks(undefined)).toEqual([]);
    expect(parseMarkdownLinks(42)).toEqual([]);
    expect(parseMarkdownLinks({})).toEqual([]);
  });

  it("leaves malformed markdown as literal text", () => {
    expect(parseMarkdownLinks("[no closing paren](/a")).toEqual([
      { type: "text", value: "[no closing paren](/a" },
    ]);
    expect(parseMarkdownLinks("[empty]()")).toEqual([
      { type: "text", value: "[empty]()" },
    ]);
    expect(parseMarkdownLinks("(/a)[reversed]")).toEqual([
      { type: "text", value: "(/a)[reversed]" },
    ]);
  });

  it("is not confused by a stray bracket or parenthesis", () => {
    expect(parseMarkdownLinks("costs (approx) [see](/x)")).toEqual([
      { type: "text", value: "costs (approx) " },
      { type: "link", label: "see", href: "/x", offset: 15 },
    ]);
  });

  it("truncates a url containing a closing paren — a known limit", () => {
    const [token] = parseMarkdownLinks("[wiki](https://x.org/A_(b))");
    expect(token).toEqual({
      type: "link",
      label: "wiki",
      href: "https://x.org/A_(b",
      offset: 0,
    });
  });

  it("keeps unsafe schemes as literal text", () => {
    for (const href of [
      "javascript:alert(1",
      "JavaScript:alert(1",
      "data:text/html;base64,PHN2Zz4",
      "vbscript:msgbox",
      "java\tscript:alert(1",
      "java\nscript:alert(1",
      " javascript:alert(1",
    ]) {
      const tokens = parseMarkdownLinks(`before [x](${href}) after`);
      expect(tokens.some((t) => t.type === "link")).toBe(false);
      expect(tokens.map((t) => (t.type === "text" ? t.value : "")).join("")).toBe(
        `before [x](${href}) after`,
      );
    }
  });

  it("still renders safe links in a string that also carries an unsafe one", () => {
    const tokens = parseMarkdownLinks("[bad](javascript:x) and [good](/g)");
    expect(tokens.filter((t) => t.type === "link")).toEqual([
      { type: "link", label: "good", href: "/g", offset: 24 },
    ]);
  });

  it("does not leak regex state between calls", () => {
    const input = "[a](/a) and [b](/b)";
    expect(parseMarkdownLinks(input)).toEqual(parseMarkdownLinks(input));
  });
});
