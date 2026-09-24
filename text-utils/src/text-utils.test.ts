import { describe, expect, it } from "vitest";
import { demoteHeadings } from "./demoteHeadings.js";
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

describe("demoteHeadings", () => {
  it("renames h1 to h2 and keeps the attributes", () => {
    expect(demoteHeadings('<h1 class="title" id="intro">Intro</h1><p>Body</p>')).toBe(
      '<h2 class="title" id="intro">Intro</h2><p>Body</p>',
    );
  });

  it("is case-insensitive", () => {
    expect(demoteHeadings('<H1 Class="x">A</H1><h1>B</H1>')).toBe(
      '<h2 Class="x">A</h2><h2>B</h2>',
    );
  });

  it("keeps nested inline tags", () => {
    expect(demoteHeadings('<h1>Big <strong>news</strong>, <a href="/x">read</a></h1>')).toBe(
      '<h2>Big <strong>news</strong>, <a href="/x">read</a></h2>',
    );
  });

  it("handles an empty h1", () => {
    expect(demoteHeadings("<h1></h1>")).toBe("<h2></h2>");
  });

  it("matches every character that ends a tag name", () => {
    expect(demoteHeadings("<h1\tid=a>x</h1\n>")).toBe("<h2\tid=a>x</h2\n>");
    expect(demoteHeadings("<h1\fid=a>x</h1\r>")).toBe("<h2\fid=a>x</h2\r>");
    expect(demoteHeadings("<h1/>")).toBe("<h2/>");
  });

  it("leaves every other tag alone", () => {
    const html = "<header><h2>A</h2><h10>B</h10><h1-x>C</h1-x><hr></header>";
    expect(demoteHeadings(html)).toBe(html);
  });

  it("leaves html with no h1, plain text and escaped markup alone", () => {
    for (const html of ["", "<p>No heading here</p>", "Use &lt;h1&gt; once; h1 is text"]) {
      expect(demoteHeadings(html)).toBe(html);
    }
  });

  it("returns non-string input unchanged", () => {
    expect(demoteHeadings(null)).toBe(null);
    expect(demoteHeadings(undefined)).toBe(undefined);
    expect(demoteHeadings(42)).toBe(42);
    const trusted = { toString: () => "<h1>x</h1>" };
    expect(demoteHeadings(trusted)).toBe(trusted);
  });

  it("is idempotent", () => {
    const once = demoteHeadings("<h1>A</h1><h2>B</h2>");
    expect(demoteHeadings(once)).toBe(once);
  });
});
