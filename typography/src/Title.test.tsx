import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PilotTitle from "./__fixtures__/Title-pilot.js";
import * as entry from "./index.js";
import { Title, type TitleProps, type TitleSize } from "./Title.js";

type Props = Omit<TitleProps, "children">;

const render = (children: ReactNode, props: Props = {}) =>
  renderToStaticMarkup(<Title {...props}>{children}</Title>);

const renderPilot = (children: ReactNode, props: Props = {}) =>
  renderToStaticMarkup(<PilotTitle {...props}>{children}</PilotTitle>);

const ACCENT_SPAN =
  /<span data-slot="title-accent" data-marker="(\/\/|##)" style="-webkit-text-fill-color:currentColor">([\s\S]*?)<\/span>/g;

const notation = (html: string) =>
  html.replace(/^<h2 [^>]*>|<\/h2>$/g, "").replace(ACCENT_SPAN, "[$1:$2]");

const HEADING = '<h2 data-slot="title" data-size="xl" class="text-size-xl">';
const sizes: TitleSize[] = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];

const requesterCases: Array<[string, string]> = [
  ["Discover // TransRussia", "Discover [//:TransRussia]"],
  ["Why Choose // TransRussia // 2027", "Why Choose [//:TransRussia] [//:2027]"],
  ["// Inner   page // header", "[//:Inner]   page [//:header]"],
  ["Why Exhibit at // Weldex 2025", "Why Exhibit at [//:Weldex] 2025"],
  ["Meet ## at mitt 2027?", "Meet [##:at mitt 2027?]"],
  ["Plan //your visit ## and more // stuff", "Plan [//:your] visit [##:and more stuff]"],
  ["See https://x.com // here", "See https://x.com [//:here]"],
  ["##Only tail", "[##:Only tail]"],
  ["trailing //", "trailing"],
  ["Have // Questions? //", "Have [//:Questions?]"],
  ["Why Exhibit ## At MITT 2027?", "Why Exhibit [##:At MITT 2027?]"],
  ["Get Connected with  ##Aquaflame 2025##", "Get Connected with  [##:Aquaflame 2025]"],
  ["##WorldFood## Moscow 2026", "[##:WorldFood] Moscow 2026"],
  ["A ##b## c ##d e", "A [##:b] c [##:d e]"],
  ["Plan //your visit ## and // more", "Plan [//:your] visit [##:and more]"],
  ["Conference// Programme", "Conference// Programme"],
  ["Digest #3", "Digest #3"],
];

const correction4Cases: Array<[string, string]> = [
  ["##see https://x.com##", "[##:see https://x.com]"],
  ["## see https://x.com", "[##:see https://x.com]"],
  ["## a//b", "[##:a//b]"],
  ["## //a//b", "[##:a//b]"],
  ["## ////word", "[##://word]"],
  ["## ////", "[##://]"],
];

const keepTextCases: Array<[string, string]> = [
  ["Discover // TransRussia", "Discover [//:TransRussia]"],
  ["Why Choose // TransRussia // 2027", "Why Choose [//:TransRussia] [//:2027]"],
  ["// Inner   page // header", "[//:Inner]   page [//:header]"],
  ["Have // Questions? //", "Have [//:Questions?]"],
  ["Visit ##Moscow##, 2027", "Visit [##:Moscow], 2027"],
  ["Get Connected with  ##Aquaflame 2025##", "Get Connected with  [##:Aquaflame 2025]"],
  ["Line one\n// Two three", "Line one\n[//:Two] three"],
  ["Welcome\nhttps://example.com", "Welcome\nhttps://example.com"],
  ["See https://x.com // here", "See https://x.com [//:here]"],
  ["##see https://x.com##", "[##:see https://x.com]"],
  ["##a//b##", "[##:a//b]"],
  ["Plan //your visit ## and // more", "Plan [//:your] visit [##:and more]"],
  ["Conference// Programme", "Conference// Programme"],
];

const behaviourCases: Array<[string, string]> = [
  ["Visit\nhttps://x.com", "Visit\nhttps://x.com"],
  ["### title", "[##:# title]"],
  ["## a ## b", "[##:a] b"],
  ["a##b##c", "a[##:b]c"],
  ["##Aquaflame 2025##s", "[##:Aquaflame 2025]s"],
  ["// ##x##", " [##:x]"],
  ["// ##x## y", " [##:x] y"],
  ["Plan // ##x##", "Plan [##:x]"],
  ["##a //##", "[##:a]"],
  ["##a  b##", "[##:a  b]"],
  ["##a\nb##", "[##:a\nb]"],
  ["a //b##c##", "a [//:b][##:c]"],
  ["a // // b", "a [//:b]"],
  ["a // \n", "a \n"],
  ["  Lead // x", "  Lead [//:x]"],
];

// Inputs whose markup intentionally differs from the 0.1.0 pilot.
const changedFromPilot = new Set<string>([
  "// Inner   page // header",
  "Get Connected with  ##Aquaflame 2025##",
  "Visit\nhttps://x.com",
  "a##b##c",
  "##Aquaflame 2025##s",
  "// ##x##",
  "// ##x## y",
]);

const plainStrings = [
  "Plain title",
  "  Spaced   title \n",
  "C# and F#",
  "a/b/c",
  "50% off & more",
  "<b>bold</b>",
];

const nullInputs: Array<[string, ReactNode]> = [
  ["undefined", undefined],
  ["null", null],
  ["false", false],
  ['""', ""],
  ["blank", "   "],
  ["whitespace", "\n\t "],
  ['"//"', "//"],
  ['"##"', "##"],
  ['"####"', "####"],
  ['"## ##"', "## ##"],
  ['"// ##"', "// ##"],
  ['" // "', " // "],
  ["[]", []],
];

const newNullInputs: Array<[string, ReactNode]> = [
  ['[""]', [""]],
  ["[null]", [null]],
  ["blank pieces", [" ", "\n"]],
  ["marker-only pieces", [false, "  // ", undefined]],
  ['"  // "', "  // "],
];

describe("Title key warnings", () => {
  it("logs nothing to console.error for multi-accent titles", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render("Why Choose // TransRussia // 2027");
    render("A ##b## c ##d e // f //g", { accentClassName: "text-white" });
    renderToString(<Title>Plan //your visit ## and more // stuff</Title>);
    render([" ", "Why Choose // TransRussia ##2027##"]);
    const calls = [...error.mock.calls];
    error.mockRestore();
    expect(calls).toEqual([]);
  });
});

describe("Title markers", () => {
  it.each(requesterCases)("requester case %j", (input, expected) => {
    expect(notation(render(input))).toBe(expected);
  });

  it.each(correction4Cases)("correction 4 case %j", (input, expected) => {
    expect(notation(render(input))).toBe(expected);
  });

  it.each(behaviourCases)("behaviour note %j", (input, expected) => {
    expect(notation(render(input))).toBe(expected);
  });

  it.each(keepTextCases)("keeps the typed text in %j", (input, expected) => {
    expect(notation(render(input))).toBe(expected);
  });

  it("splits text nodes only at accents", () => {
    expect(render("Visit ##Moscow##, 2027")).toBe(
      `${HEADING}Visit <span data-slot="title-accent" data-marker="##" style="-webkit-text-fill-color:currentColor">Moscow</span>, 2027</h2>`,
    );
  });

  it("renders strings without markers exactly as given", () => {
    expect(render("  Spaced   title \n")).toBe(`${HEADING}  Spaced   title \n</h2>`);
    expect(render("Digest #3")).toBe(`${HEADING}Digest #3</h2>`);
    expect(render("Welcome\nhttps://example.com")).toBe(`${HEADING}Welcome\nhttps://example.com</h2>`);
  });

  it("leaves children that are not all text untouched", () => {
    expect(render([<em key="em">x</em>, " // y"])).toBe(`${HEADING}<em>x</em> // y</h2>`);
    expect(render([["a // b"], " c"])).toBe(`${HEADING}a // b c</h2>`);
    expect(render(<em>x // y</em>)).toBe(`${HEADING}<em>x // y</em></h2>`);
  });

  it("reads markers in children made only of text", () => {
    expect(notation(renderToStaticMarkup(<Title> {"Discover // TransRussia"}</Title>))).toBe(
      " Discover [//:TransRussia]",
    );
    expect(notation(renderToStaticMarkup(<Title>Discover // {"TransRussia"}</Title>))).toBe(
      "Discover [//:TransRussia]",
    );
    expect(notation(render([null, "Visit ##Moscow##", false, ", ", 2027, undefined, true]))).toBe(
      "Visit [##:Moscow], 2027",
    );
  });

  it("joins children made only of text without markers into one string", () => {
    expect(renderToString(<Title>{"a"} {"b"}</Title>)).toBe(`${HEADING}a b</h2>`);
    expect(render([0])).toBe(`${HEADING}0</h2>`);
  });

  it("applies accentClassName to accents read from text children", () => {
    expect(render([" ", "// a"], { accentClassName: "text-white" })).toContain(
      'data-marker="//" class="text-white"',
    );
  });

  it("escapes text inside and around accents", () => {
    expect(render("<b>x</b> // <i>")).toBe(
      `${HEADING}&lt;b&gt;x&lt;/b&gt; <span data-slot="title-accent" data-marker="//" style="-webkit-text-fill-color:currentColor">&lt;i&gt;</span></h2>`,
    );
  });

  it("keeps plain words between accents in one text node", () => {
    const html = renderToString(<Title>a b // c d e</Title>);
    expect(html).not.toContain("<!-- -->");
    expect(html).toContain(">a b <span");
    expect(html).toContain("</span> d e</h2>");
    expect(renderToString(<Title> {"a  b // c\nd e"}</Title>)).not.toContain("<!-- -->");
  });
});

describe("Title matches the pilot", () => {
  const children: ReactNode[] = [
    ...requesterCases.map(([input]) => input),
    ...correction4Cases.map(([input]) => input),
    "### title",
    "## a ## b",
    ...plainStrings,
    ...nullInputs.map(([, input]) => input),
    "<b>x</b> // <i>y</i>",
    "a b // c d e",
    0,
    2027,
    <em key="em">Emphasis</em>,
    [<em key="em">x</em>, " // y"],
    [["a // b"], " c"],
  ].filter((child) => typeof child !== "string" || !changedFromPilot.has(child));

  it.each([...changedFromPilot])("differs from the pilot on purpose for %j", (input) => {
    expect(render(input)).not.toBe(renderPilot(input));
  });

  const variants: Array<[string, Props]> = [
    ["defaults", {}],
    ...sizes.map((size): [string, Props] => [`size ${size}`, { size }]),
    ["pageHeader", { pageHeader: true }],
    ['as="p"', { as: "p" }],
    ['as="p" with pageHeader', { as: "p", pageHeader: true }],
    ["className text-white", { className: "text-white" }],
    ["className text-lg", { className: "text-lg" }],
    ["className text-[20px]", { className: "text-[20px]" }],
    ["className text-size-sm", { className: "text-size-sm" }],
    ["className unrelated", { className: "mb-4 uppercase tracking-wide" }],
    ["size lg with className", { size: "lg", className: "text-white mt-2" }],
    ["accentClassName", { accentClassName: "text-white" }],
    ["accentClassName with conflicts", { accentClassName: "text-red-500 text-white" }],
    [
      "every prop",
      { size: "3xl", pageHeader: true, className: "text-white text-lg", accentClassName: "underline" },
    ],
  ];

  it.each(variants)("%s", (_, props) => {
    for (const child of children) {
      expect(render(child, props), JSON.stringify(child)).toBe(renderPilot(child, props));
    }
  });
});

describe("Title tags", () => {
  const expectedTag: Record<TitleSize, string> = {
    "4xl": "h2",
    "3xl": "h2",
    "2xl": "h2",
    xl: "h2",
    lg: "h3",
    md: "h4",
    sm: "h5",
    xs: "h6",
  };

  it.each(sizes)("size %s renders its default tag", (size) => {
    const tag = expectedTag[size];
    expect(render("Hi", { size })).toBe(
      `<${tag} data-slot="title" data-size="${size}" class="text-size-${size}">Hi</${tag}>`,
    );
  });

  it("renders h1 for pageHeader", () => {
    expect(render("Hi", { pageHeader: true, size: "sm" })).toMatch(/^<h1 [^>]*>Hi<\/h1>$/);
  });

  it("renders the as override", () => {
    expect(render("Hi", { as: "p" })).toMatch(/^<p [^>]*>Hi<\/p>$/);
  });

  it("lets pageHeader beat as", () => {
    expect(render("Hi", { as: "p", pageHeader: true })).toMatch(/^<h1 [^>]*>Hi<\/h1>$/);
  });
});

describe("Title attributes", () => {
  it("sets data-slot and a default data-size of xl", () => {
    expect(render("Hi")).toBe(`${HEADING}Hi</h2>`);
  });

  it("reports the size prop in data-size", () => {
    expect(render("Hi", { size: "2xl" })).toContain('data-size="2xl"');
  });

  it("marks // and ## accents with their marker and the inline fill", () => {
    expect(render("a // b ##c d##")).toBe(
      `${HEADING}a <span data-slot="title-accent" data-marker="//" style="-webkit-text-fill-color:currentColor">b</span> <span data-slot="title-accent" data-marker="##" style="-webkit-text-fill-color:currentColor">c d</span></h2>`,
    );
  });
});

describe("Title accentClassName", () => {
  it("is set on every // and ## accent span", () => {
    const html = render("x // a ## b c", { accentClassName: "text-white" });
    expect(html).toContain(
      '<span data-slot="title-accent" data-marker="//" class="text-white" style="-webkit-text-fill-color:currentColor">a</span>',
    );
    expect(html).toContain(
      '<span data-slot="title-accent" data-marker="##" class="text-white" style="-webkit-text-fill-color:currentColor">b c</span>',
    );
  });

  it("is set as given, without twMerge", () => {
    expect(render("// a", { accentClassName: "text-red-500 text-white" })).toContain(
      'class="text-red-500 text-white"',
    );
  });

  it("leaves accent spans without a class attribute when not passed", () => {
    const html = render("x // a ## b c");
    expect(html.match(/<span [^>]*>/g)).toHaveLength(2);
    expect(html.match(/<span [^>]*class=/g)).toBeNull();
  });

  it("does not change a title without markers", () => {
    expect(render("Plain title", { accentClassName: "text-white" })).toBe(render("Plain title"));
  });
});

describe("Title class merge", () => {
  const classOf = (className: string) => render("Hi", { className }).match(/ class="([^"]*)"/)?.[1];

  it("keeps text-size-xl beside a text colour", () => {
    expect(classOf("text-white")).toBe("text-size-xl text-white");
  });

  it("drops text-size-xl for another font size", () => {
    expect(classOf("text-lg")).toBe("text-lg");
    expect(classOf("text-[20px]")).toBe("text-[20px]");
  });

  it("lets text-size-sm replace the size class while data-size keeps the prop", () => {
    const html = render("Hi", { className: "text-size-sm" });
    expect(html).toContain('class="text-size-sm"');
    expect(html).toContain('data-size="xl"');
  });

  it("keeps unrelated classes in order", () => {
    expect(classOf("mb-4 uppercase tracking-wide")).toBe("text-size-xl mb-4 uppercase tracking-wide");
  });
});

describe("Title null guard", () => {
  it.each([...nullInputs, ...newNullInputs])("renders nothing for %s", (_, input) => {
    expect(render(input)).toBe("");
  });

  it("renders 0", () => {
    expect(render(0)).toBe(`${HEADING}0</h2>`);
  });
});

describe("Title source", () => {
  const source = readFileSync(new URL("./Title.tsx", import.meta.url), "utf8");

  it.each(sizes)("contains the full literal text-size-%s", (size) => {
    expect(source).toContain(`"text-size-${size}"`);
  });

  it('has no "use client" directive', () => {
    expect(source).not.toContain("use client");
  });

  it("exports only Title from the entry", () => {
    expect(Object.keys(entry)).toEqual(["Title"]);
    expect(entry.Title).toBe(Title);
  });
});
