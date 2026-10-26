/**
 * `generateLlmsTxt` against real exports in temp dirs. The heads are the Mosbuild snippets
 * `buildNoIndex.test.ts` uses: indexed, noindex, refresh in head.
 */

import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { generateLlmsTxt, type PostFetchLike } from "./llmsTxt.js";

const SITE = "https://site.test";
const GRAPHQL = "https://ite-cms.test/graphql";
const OPTS = {
  siteUrl: SITE,
  strapiGraphqlUrl: GRAPHQL,
  homepageType: "mosBuildHomepage",
  navBarType: "mosBuildNavBar",
};

const INDEXED = `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><title>About</title><meta name="robots" content="index, follow"/><meta name="googlebot" content="index, follow"/><link rel="canonical" href="https://mosbuildexpo.com/about/"/></head><body><p>hi</p></body></html>`;
const NOINDEX = `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><title>Campaign components</title><meta name="robots" content="noindex, nofollow"/><meta name="googlebot" content="noindex, nofollow"/></head><body></body></html>`;
const refresh = (content: string) =>
  `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="${content}"/><title>Redirecting...</title></head><body></body></html>`;
const PDF = "%PDF-1.7\n";

const NAV = [
  { Title: "Visit", LinkTo: "/visit", Links: [] },
  {
    Title: "Exhibit",
    LinkTo: null,
    Links: [
      { Text: "Why exhibit", LinkTo: "exhibit/why" },
      { Text: "Floor plan", LinkTo: "/floorplan" },
      { Text: "Brochure", LinkTo: "/files/brochure.pdf" },
      { Text: "Book a stand", LinkTo: "https://forms.example.com/stand/" },
      { Text: "Coming soon", LinkTo: null },
      { Text: "Blank", LinkTo: "   " },
    ],
  },
  {
    Title: "About",
    LinkTo: "about/",
    Links: [
      { Text: "Team", LinkTo: "https://site.test/about/team" },
      { Text: "Contact", LinkTo: "/contact/?from=nav#form" },
      { Text: "Partners", LinkTo: "http://site.test/partners/" },
      { Text: "Email us", LinkTo: "mailto:info@site.test" },
      { Text: "Call us", LinkTo: "tel:+70000000000" },
      { Text: "Chat", LinkTo: "javascript:void(0)" },
    ],
  },
  {
    Title: "Register",
    LinkTo: "",
    Links: [
      { Text: "Pre-register", LinkTo: "/pre-reg/" },
      { Text: "Tickets", LinkTo: "/tickets/" },
      { Text: "Old form", LinkTo: "/old/" },
      { Text: "Floor plan (PDF)", LinkTo: "/floorplan" },
    ],
  },
  { Title: "Speakers", LinkTo: "/speakers/", Links: [{ Text: "All speakers", LinkTo: "speakers" }] },
  {
    Title: "Media",
    LinkTo: null,
    Links: [
      { Text: "Programme [2026]\n  \\ day one", LinkTo: "/programme/" },
      { Text: "Gallery", LinkTo: "/media(1)/" },
      { Text: "Выставка", LinkTo: "/выставка/" },
      { Text: "  ", LinkTo: "/press/" },
    ],
  },
  { Title: "No links", LinkTo: null, Links: null },
];

const EXPORT = {
  "visit/index.html": INDEXED,
  "exhibit/why/index.html": INDEXED,
  "floorplan.html": INDEXED,
  "files/brochure.pdf": PDF,
  "about/index.html": INDEXED,
  "about/team/index.html": INDEXED,
  "contact/index.html": INDEXED,
  "partners/index.html": INDEXED,
  "pre-reg/index.html": refresh("0; url=/vis-reg/"),
  "vis-reg/index.html": INDEXED,
  "tickets/index.html": refresh("0; url=https://tickets.example.com/"),
  "old/index.html": refresh("0; url=/older/"),
  "older/index.html": refresh("0; url=/oldest/"),
  "oldest/index.html": INDEXED,
  "speakers/index.html": INDEXED,
  "programme/index.html": INDEXED,
  "media(1)/index.html": INDEXED,
  "выставка/index.html": INDEXED,
  "press/index.html": INDEXED,
};

const EXPECTED = String.raw`# Mosbuild 2026

> The big show.

## Pages

- [Visit](https://site.test/visit/)
- [Why exhibit](https://site.test/exhibit/why/)
- [Floor plan](https://site.test/floorplan)
- [Brochure](https://site.test/files/brochure.pdf)
- [About](https://site.test/about/)
- [Team](https://site.test/about/team/)
- [Contact](https://site.test/contact/)
- [Pre-register](https://site.test/vis-reg/)
- [Speakers](https://site.test/speakers/)
- [Programme \[2026\] \\ day one](https://site.test/programme/)
- [Gallery](https://site.test/media%281%29/)
- [Выставка](https://site.test/%D0%B2%D1%8B%D1%81%D1%82%D0%B0%D0%B2%D0%BA%D0%B0/)
- [https://site.test/press/](https://site.test/press/)
`;

const SEO = { metaTitle: "Mosbuild 2026", metaDescription: "The big show." };

function cms(nav: unknown, seo: unknown = SEO) {
  return { data: { mosBuildHomepage: { seo }, mosBuildNavBar: { Data: nav } } };
}

const CMS = cms(NAV);

type Call = { url: string; init: unknown };
function fakeFetch(payload: unknown, calls: Call[] = []) {
  return async (url: string, init: unknown) => {
    calls.push({ url, init });
    return { json: async () => payload };
  };
}

function write(dir: string, files: Record<string, string>) {
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
}

const dirs: string[] = [];
function tmpRoot() {
  const d = mkdtempSync(join(tmpdir(), "llms-"));
  dirs.push(d);
  return d;
}
/** A fresh export holding a homepage plus `files`. */
function tmp(files: Record<string, string> = {}) {
  const out = join(tmpRoot(), "out");
  write(out, { "index.html": INDEXED, ...files });
  return out;
}
const read = (out: string) => readFileSync(join(out, "llms.txt"), "utf-8");

async function run(nav: unknown, files: Record<string, string>, seo?: unknown) {
  const out = tmp(files);
  await generateLlmsTxt({ ...OPTS, outDir: out, fetch: fakeFetch(cms(nav, seo)) });
  return read(out);
}

let log: MockInstance<typeof console.log>;
let logs: string[];
let errors: string[];
beforeEach(() => {
  logs = [];
  errors = [];
  log = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void errors.push(a.join(" ")));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  expect([...logs, ...errors].filter((line) => !line.startsWith("[llms.txt] "))).toEqual([]);
});

describe("generateLlmsTxt", () => {
  it("writes the byte-exact file for every nav shape and link rule", async () => {
    const out = tmp(EXPORT);
    await generateLlmsTxt({ ...OPTS, outDir: out, fetch: fakeFetch(CMS) });
    expect(read(out)).toBe(EXPECTED);
    expect(logs).toEqual([
      '[llms.txt] Ignoring external link "Book a stand" --> https://forms.example.com/stand/',
      '[llms.txt] Ignoring external link "Partners" --> http://site.test/partners/',
      '[llms.txt] Ignoring non-http link "Email us" --> mailto:info@site.test',
      '[llms.txt] Ignoring non-http link "Call us" --> tel:+70000000000',
      '[llms.txt] Ignoring non-http link "Chat" --> javascript:void(0)',
      '[llms.txt] Ignoring external link "Tickets" --> https://tickets.example.com/ (redirect from https://site.test/tickets/)',
      `[llms.txt] generated → ${out}/llms.txt`,
    ]);
    expect(errors).toEqual([
      '[llms.txt] Dropping "Old form" --> https://site.test/old/: it redirects to https://site.test/older/, which redirects again.',
    ]);
  });

  it("posts the legacy GraphQL query text with the JSON content type", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const calls: Call[] = [];
    await generateLlmsTxt({ ...OPTS, outDir: tmp(), fetch: fakeFetch(CMS, calls) });
    const init = calls[0].init as { method: string; headers: Record<string, string>; body: string };
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({
      query: `query {
    mosBuildHomepage {
      seo {
        metaTitle
        metaDescription
      }
    }
    mosBuildNavBar {
      Data {
        Title
        LinkTo
        Links {
          Text
          LinkTo
        }
      }
    }
  }`,
    });
  });

  it("uses the global fetch when none is injected", async () => {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", fakeFetch(CMS, calls));
    const out = tmp(EXPORT);
    await generateLlmsTxt({ ...OPTS, outDir: out });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(GRAPHQL);
    expect(read(out)).toBe(EXPECTED);
  });

  it("logs the generated line exactly as before, once, last", async () => {
    const out = tmp(EXPORT);
    await generateLlmsTxt({ ...OPTS, outDir: out, fetch: fakeFetch(CMS) });
    expect(log).toHaveBeenLastCalledWith("[llms.txt] generated →", `${out}/llms.txt`);
    expect(log.mock.calls.filter((c) => c[0] === "[llms.txt] generated →")).toHaveLength(1);
  });

  it("reads an outDir relative to the working directory, as next-sitemap passes it", async () => {
    const out = relative(process.cwd(), tmp(EXPORT));
    await generateLlmsTxt({ ...OPTS, outDir: out, fetch: fakeFetch(CMS) });
    expect(read(out)).toBe(EXPECTED);
  });

  it.each(["https://site.test", "https://site.test/"])("accepts siteUrl %j", async (siteUrl) => {
    const out = tmp(EXPORT);
    await generateLlmsTxt({ ...OPTS, siteUrl, outDir: out, fetch: fakeFetch(CMS) });
    expect(read(out)).toBe(EXPECTED);
  });
});

describe("links", () => {
  it("drops a page missing from the export with console.error, and a noindex page with console.log", async () => {
    const nav = [
      { Title: "Visit", LinkTo: "/visit/" },
      { Title: "Ghost", LinkTo: "/ghost/" },
      { Title: "Showcase", LinkTo: "/showcase/" },
    ];
    expect(await run(nav, { "visit/index.html": INDEXED, "showcase/index.html": NOINDEX })).toBe(
      "# Mosbuild 2026\n\n> The big show.\n\n## Pages\n\n- [Visit](https://site.test/visit/)\n",
    );
    expect(errors).toEqual(['[llms.txt] Dropping "Ghost" --> https://site.test/ghost/: not in the export.']);
    expect(logs[0]).toBe('[llms.txt] Ignoring noindex link "Showcase" --> https://site.test/showcase/');
  });

  it.each([
    ["a directory with no index.html", "/files/"],
    ["a path through a file", "/files/brochure.pdf/page/"],
    ["a name too long for the file system", `/${"a".repeat(300)}/`],
    ["a NUL byte", "/visit%00/"],
    ["broken percent-encoding", "/100%/"],
  ])("drops %s as not exported, without throwing", async (_, linkTo) => {
    await run([{ Title: "X", LinkTo: linkTo }], { "files/brochure.pdf": PDF, "visit/index.html": INDEXED });
    expect(errors[0]).toMatch(/^\[llms\.txt\] Dropping "X" --> .*: not in the export\.$/);
  });

  it("drops a link the URL parser rejects with console.error", async () => {
    expect(await run([{ Title: "Bad", LinkTo: "http://" }, { Title: "Visit", LinkTo: "/visit/" }], { "visit/index.html": INDEXED })).toContain(
      "- [Visit](https://site.test/visit/)\n",
    );
    expect(errors).toEqual(['[llms.txt] Dropping "Bad" --> "http://": not a valid URL.']);
  });

  it("never lists a file outside outDir, however the CMS path is encoded", async () => {
    const root = tmpRoot();
    write(root, { "secret.txt": "secret", "private/index.html": INDEXED });
    const out = join(root, "site", "out");
    write(out, { "index.html": INDEXED, "visit/index.html": INDEXED });
    expect(existsSync(join(out, "../../secret.txt"))).toBe(true);
    const nav = [
      { Title: "Secret", LinkTo: "/..%2F..%2Fsecret.txt" },
      { Title: "Private", LinkTo: "/..%2F..%2Fprivate/" },
      { Title: "Visit", LinkTo: "/visit/" },
    ];
    await generateLlmsTxt({ ...OPTS, outDir: out, fetch: fakeFetch(cms(nav)) });
    expect(read(out)).toBe("# Mosbuild 2026\n\n> The big show.\n\n## Pages\n\n- [Visit](https://site.test/visit/)\n");
    expect(errors).toEqual([
      '[llms.txt] Dropping "Secret" --> https://site.test/..%2F..%2Fsecret.txt: not in the export.',
      '[llms.txt] Dropping "Private" --> https://site.test/..%2F..%2Fprivate/: not in the export.',
    ]);
  });

  it("lists an editor's own homepage link as the origin with one slash, once", async () => {
    const nav = [
      { Title: "Home", LinkTo: "/" },
      { Title: "Top", LinkTo: "#top" },
      { Title: "Home again", LinkTo: "https://site.test" },
    ];
    expect(await run(nav, {})).toBe("# Mosbuild 2026\n\n> The big show.\n\n## Pages\n\n- [Home](https://site.test/)\n");
  });

  it("lists a directory whose name merely starts with two dots", async () => {
    expect(await run([{ Title: "Dots", LinkTo: "/..dots/" }], { "..dots/index.html": INDEXED })).toContain(
      "- [Dots](https://site.test/..dots/)\n",
    );
  });

  it("trims a pasted LinkTo, non-breaking spaces included", async () => {
    expect(await run([{ Title: "Visit", LinkTo: "  /visit/  " }], { "visit/index.html": INDEXED })).toContain(
      "- [Visit](https://site.test/visit/)\n",
    );
  });

  it("finds an asset through its decoded name and lists it percent-encoded", async () => {
    expect(await run([{ Title: "Floor plan", LinkTo: "/files/Floor plan (2027).pdf" }], { "files/Floor plan (2027).pdf": PDF })).toContain(
      "- [Floor plan](https://site.test/files/Floor%20plan%20%282027%29.pdf)\n",
    );
  });

  it("inspects a raw .html file as a page and lists any other file unread", async () => {
    const nav = [
      { Title: "Landing", LinkTo: "/landing.html" },
      { Title: "Hidden", LinkTo: "/hidden.html" },
      { Title: "Notes", LinkTo: "/files/notes.txt" },
    ];
    const files = { "landing.html": INDEXED, "hidden.html": NOINDEX, "files/notes.txt": NOINDEX };
    expect(await run(nav, files)).toBe(
      "# Mosbuild 2026\n\n> The big show.\n\n## Pages\n\n- [Landing](https://site.test/landing.html)\n- [Notes](https://site.test/files/notes.txt)\n",
    );
    expect(logs[0]).toBe('[llms.txt] Ignoring noindex link "Hidden" --> https://site.test/hidden.html');
  });

  it("writes the file without a Pages section, and says so, when no link survives", async () => {
    const out = tmp();
    const nav = [{ Title: "Shop", LinkTo: "https://shop.example.com/" }, { Title: "Empty", LinkTo: null, Links: [] }];
    await generateLlmsTxt({ ...OPTS, outDir: out, fetch: fakeFetch(cms(nav)) });
    expect(read(out)).toBe("# Mosbuild 2026\n\n> The big show.\n");
    expect(errors).toEqual([`[llms.txt] ${out}/llms.txt has no links: no navbar entry points at a listable page.`]);
  });

  it("writes an empty navbar as a file with no links", async () => {
    expect(await run([], {}, { metaTitle: "Mosbuild 2026" })).toBe("# Mosbuild 2026\n");
    expect(errors).toHaveLength(1);
  });
});

describe("redirects", () => {
  it("resolves the target against the redirecting page's own URL", async () => {
    const nav = [
      { Title: "Old event", LinkTo: "/events/old/" },
      { Title: "Archive", LinkTo: "/archive" },
      { Title: "Download", LinkTo: "/dl/" },
    ];
    const files = {
      "events/old/index.html": `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta http-equiv="refresh" content="0; url=next/"/><title>Redirecting...</title></head><body></body></html>`,
      "events/old/next/index.html": INDEXED,
      "archive.html": refresh("0;URL='current/'"),
      "current/index.html": INDEXED,
      "dl/index.html": refresh("0; url=/files/brochure.pdf"),
      "files/brochure.pdf": PDF,
    };
    expect(await run(nav, files)).toBe(
      "# Mosbuild 2026\n\n> The big show.\n\n## Pages\n\n- [Old event](https://site.test/events/old/next/)\n- [Archive](https://site.test/current/)\n- [Download](https://site.test/files/brochure.pdf)\n",
    );
  });

  it("decodes the attribute escapes in the refresh URL", async () => {
    const nav = [{ Title: "R&D", LinkTo: "/rnd/" }];
    const files = { "rnd/index.html": refresh("0; url=/r&amp;d/"), "r&d/index.html": INDEXED };
    expect(await run(nav, files)).toContain("- [R&D](https://site.test/r&d/)\n");
  });

  it("keeps the nav text and dedupes on the target URL", async () => {
    const nav = [
      { Title: "Pre-register", LinkTo: "/pre-reg/" },
      { Title: "Visitor registration", LinkTo: "/vis-reg/" },
    ];
    const files = { "pre-reg/index.html": refresh("0; url=/vis-reg/"), "vis-reg/index.html": INDEXED };
    expect(await run(nav, files)).toBe(
      "# Mosbuild 2026\n\n> The big show.\n\n## Pages\n\n- [Pre-register](https://site.test/vis-reg/)\n",
    );
  });

  it("drops a target that is noindex, missing or not http, each saying why", async () => {
    const nav = [
      { Title: "A", LinkTo: "/a/" },
      { Title: "B", LinkTo: "/b/" },
      { Title: "C", LinkTo: "/c/" },
    ];
    const files = {
      "a/index.html": refresh("0; url=/showcase/"),
      "showcase/index.html": NOINDEX,
      "b/index.html": refresh("0; url=/ghost/"),
      "c/index.html": refresh("0; url=mailto:info@site.test"),
    };
    await run(nav, files);
    expect(logs.slice(0, 2)).toEqual([
      '[llms.txt] Ignoring noindex link "A" --> https://site.test/showcase/ (redirect from https://site.test/a/)',
      '[llms.txt] Ignoring non-http link "C" --> mailto:info@site.test (redirect from https://site.test/c/)',
    ]);
    expect(errors[0]).toBe(
      '[llms.txt] Dropping "B" --> https://site.test/ghost/ (redirect from https://site.test/b/): not in the export.',
    );
  });

  it.each(["0", "5;", "0; url=", "0; url=''", "url=/visit/"])(
    "drops a refresh with no readable URL (content %j) with console.error",
    async (content) => {
      await run([{ Title: "R", LinkTo: "/r/" }], { "r/index.html": refresh(content), "visit/index.html": INDEXED });
      expect(errors[0]).toBe('[llms.txt] Dropping "R" --> https://site.test/r/: its refresh has no readable URL.');
    },
  );
});

describe("text", () => {
  it.each([
    ["blank", "   "],
    ["null", null],
    ["missing", undefined],
  ])("writes no blockquote and no blank line for it when the description is %s", async (_, metaDescription) => {
    expect(await run([{ Title: "Visit", LinkTo: "/visit/" }], { "visit/index.html": INDEXED }, { metaTitle: "Mosbuild 2026", metaDescription })).toBe(
      "# Mosbuild 2026\n\n## Pages\n\n- [Visit](https://site.test/visit/)\n",
    );
  });

  it("collapses a multi-line title and description to one line each", async () => {
    const seo = { metaTitle: "  Mosbuild\n  2026 ", metaDescription: "The big\r\n\r\nshow.\t Moscow, April." };
    expect(await run([{ Title: "Visit", LinkTo: "/visit/" }], { "visit/index.html": INDEXED }, seo)).toBe(
      "# Mosbuild 2026\n\n> The big show. Moscow, April.\n\n## Pages\n\n- [Visit](https://site.test/visit/)\n",
    );
  });
});

describe("rejections", () => {
  const ok = { ok: true, status: 200 };
  it.each([
    ["fetch rejects", async () => { throw new Error("network down"); }, `CMS request to ${GRAPHQL} failed: network down`],
    ["fetch rejects with a non-Error", async () => { throw "socket hang up"; }, `CMS request to ${GRAPHQL} failed: socket hang up`],
    ["HTTP 503", async () => ({ ok: false, status: 503, json: async () => CMS }), `CMS request to ${GRAPHQL} failed with HTTP 503.`],
    ["not ok, no status", async () => ({ ok: false, json: async () => CMS }), `CMS request to ${GRAPHQL} failed.`],
    ["json() rejects", async () => ({ ...ok, json: async () => { throw new SyntaxError("Unexpected token <"); } }), "is not JSON: Unexpected token <"],
    ["GraphQL errors next to data", fakeFetch({ ...CMS, errors: [{ message: "Forbidden access" }, { message: "Rate limited" }] }), "GraphQL errors: Forbidden access; Rate limited"],
    ["a GraphQL error with no message", fakeFetch({ ...CMS, errors: [{ extensions: { code: "FORBIDDEN" } }] }), 'GraphQL errors: {"extensions":{"code":"FORBIDDEN"}}'],
    ["a blank metaTitle", fakeFetch(cms(NAV, { metaTitle: " \n ", metaDescription: "x" })), "no mosBuildHomepage.seo.metaTitle"],
    ["a null homepage record", fakeFetch({ data: { mosBuildHomepage: null, mosBuildNavBar: { Data: NAV } } }), "no mosBuildHomepage.seo.metaTitle"],
    ["an empty body", fakeFetch({}), "no mosBuildHomepage.seo.metaTitle"],
    ["navbar Data that is not a list", fakeFetch(cms({ Title: "Visit", LinkTo: "/visit/" })), "no mosBuildNavBar.Data list"],
    ["no navbar record", fakeFetch({ data: { mosBuildHomepage: { seo: SEO }, mosBuildNavBar: null } }), "no mosBuildNavBar.Data list"],
  ])("rejects on %s and writes nothing", async (_, fetch, message) => {
    const out = tmp(EXPORT);
    const result = generateLlmsTxt({ ...OPTS, outDir: out, fetch: fetch as PostFetchLike });
    await expect(result).rejects.toBeInstanceOf(Error);
    await expect(result).rejects.toThrow(message);
    await expect(result).rejects.toThrow(/^\[llms\.txt\] /);
    expect(existsSync(join(out, "llms.txt"))).toBe(false);
  });

  it("takes an empty errors array as no error", async () => {
    const out = tmp(EXPORT);
    await generateLlmsTxt({ ...OPTS, outDir: out, fetch: fakeFetch({ ...CMS, errors: [] }) });
    expect(read(out)).toBe(EXPECTED);
  });

  it.each(["site.test", "", "https://site.test/en", "https://site.test/en/", "ftp://site.test", "mailto:info@site.test"])(
    "rejects siteUrl %j before any request",
    async (siteUrl) => {
      const calls: Call[] = [];
      await expect(generateLlmsTxt({ ...OPTS, siteUrl, outDir: tmp(EXPORT), fetch: fakeFetch(CMS, calls) })).rejects.toThrow(
        `[llms.txt] siteUrl must be an http(s) origin such as "https://example.com", got ${JSON.stringify(siteUrl)}.`,
      );
      expect(calls).toEqual([]);
    },
  );

  it.each([
    ["has no index.html", (out: string) => rmSync(join(out, "index.html"))],
    ["does not exist", (out: string) => rmSync(out, { recursive: true })],
  ])("rejects before any request when the export %s", async (_, breakExport) => {
    const out = tmp(EXPORT);
    breakExport(out);
    const calls: Call[] = [];
    await expect(generateLlmsTxt({ ...OPTS, outDir: out, fetch: fakeFetch(CMS, calls) })).rejects.toThrow(
      `[llms.txt] ${join(out, "index.html")} does not exist.`,
    );
    expect(calls).toEqual([]);
  });

  describe.skipIf(process.getuid?.() === 0)("on an unreadable export", () => {
    it.each([
      ["a file cannot be checked", "sealed", "sealed"],
      ["a page cannot be read", "locked", "locked/index.html"],
    ])("rejects when %s", async (_, page, locked) => {
      const out = tmp({ [`${page}/index.html`]: INDEXED });
      chmodSync(join(out, locked), 0o000);
      try {
        await expect(generateLlmsTxt({ ...OPTS, outDir: out, fetch: fakeFetch(cms([{ Title: "X", LinkTo: `/${page}/` }])) })).rejects.toThrow(
          `[llms.txt] Could not read ${join(out, page, "index.html")}: EACCES`,
        );
      } finally {
        chmodSync(join(out, locked), 0o755);
      }
    });
  });

  describe("on a response that is not OK", () => {
    const messageOf = (run: Promise<void>) => run.then(() => "resolved", (e: Error) => e.message);

    it("adds the GraphQL error messages from the body to the status", async () => {
      const body = { errors: [{ message: 'Field "NavText" must not have a selection since type "String" has no subfields.' }] };
      const fetch = async () => ({ ok: false, status: 400, json: async () => body });
      expect(await messageOf(generateLlmsTxt({ ...OPTS, navText: "component", outDir: tmp(EXPORT), fetch }))).toBe(
        `[llms.txt] CMS request to ${GRAPHQL} failed with HTTP 400: Field "NavText" must not have a selection since type "String" has no subfields.`,
      );
    });

    it("keeps the status-only message when the body is not JSON", async () => {
      const fetch = async () => ({ ok: false, status: 503, json: async () => { throw new SyntaxError("Unexpected token <"); } });
      expect(await messageOf(generateLlmsTxt({ ...OPTS, outDir: tmp(EXPORT), fetch }))).toBe(
        `[llms.txt] CMS request to ${GRAPHQL} failed with HTTP 503.`,
      );
    });
  });

  it("rejects when llms.txt cannot be written", async () => {
    const out = tmp(EXPORT);
    mkdirSync(join(out, "llms.txt"));
    await expect(generateLlmsTxt({ ...OPTS, outDir: out, fetch: fakeFetch(CMS) })).rejects.toThrow(
      `[llms.txt] Could not write ${out}/llms.txt: EISDIR`,
    );
    expect(log).not.toHaveBeenCalledWith("[llms.txt] generated →", expect.anything());
  });
});

describe("navText", () => {
  const QUERY_HEAD = `query {
    mosBuildHomepage {
      seo {
        metaTitle
        metaDescription
      }
    }
    mosBuildNavBar {
      Data {
        Title
        LinkTo
        Links {
          Text
          LinkTo
        }
      }`;
  const PAGES = "## Pages\n\n- [Visit](https://site.test/visit/)\n";

  async function runNavText(navText: string, value: unknown, nav: unknown = [{ Title: "Visit", LinkTo: "/visit/" }], seo: unknown = SEO) {
    const out = tmp({ "visit/index.html": INDEXED });
    const payload = { data: { mosBuildHomepage: { seo }, mosBuildNavBar: { Data: nav, NavText: value } } };
    await generateLlmsTxt({ ...OPTS, navText: navText as never, outDir: out, fetch: fakeFetch(payload) });
    return read(out);
  }

  async function queryFor(navText: unknown) {
    const calls: Call[] = [];
    await generateLlmsTxt({ ...OPTS, navText: navText as never, outDir: tmp(), fetch: fakeFetch(CMS, calls) });
    return (JSON.parse((calls[0].init as { body: string }).body) as { query: string }).query;
  }

  it("asks for the component's two texts", async () => {
    expect(await queryFor("component")).toBe(`query {
    mosBuildHomepage {
      seo {
        metaTitle
        metaDescription
      }
    }
    mosBuildNavBar {
      Data {
        Title
        LinkTo
        Links {
          Text
          LinkTo
        }
      }
      NavText {
        Text1
        Text2
      }
    }
  }`);
  });

  it("asks for the bare string", async () => {
    expect(await queryFor("string")).toBe(`query {
    mosBuildHomepage {
      seo {
        metaTitle
        metaDescription
      }
    }
    mosBuildNavBar {
      Data {
        Title
        LinkTo
        Links {
          Text
          LinkTo
        }
      }
      NavText
    }
  }`);
  });

  it("treats an explicit undefined as omitted", async () => {
    expect(await queryFor(undefined)).toBe(`${QUERY_HEAD}\n    }\n  }`);
    expect(errors.filter((line) => line.includes("NavText"))).toEqual([]);
  });

  it("writes the component's texts between the description and the pages, byte for byte", async () => {
    expect(await runNavText("component", { Text1: "13 - 15 April 2027 ", Text2: " Crocus Expo,  Moscow" })).toBe(`# Mosbuild 2026

> The big show.

- 13 - 15 April 2027
- Crocus Expo, Moscow

## Pages

- [Visit](https://site.test/visit/)
`);
    expect(errors).toEqual([]);
  });

  it("splits a string on line breaks and leaves no empty item", async () => {
    expect(await runNavText("string", "15-18 June 2027\nCrocus Expo, Moscow\n")).toBe(
      `# Mosbuild 2026\n\n> The big show.\n\n- 15-18 June 2027\n- Crocus Expo, Moscow\n\n${PAGES}`,
    );
  });

  it("splits on \\r\\n and on a lone \\r too", async () => {
    expect(await runNavText("string", "15-18 June 2027\r\n\r\nCrocus Expo\rMoscow")).toContain(
      "\n\n- 15-18 June 2027\n- Crocus Expo\n- Moscow\n\n## Pages",
    );
  });

  it.each([
    ["a one-line value with separators", "string", "13 - 15 April 2027 | Pavilion 3, Crocus Expo | Moscow", ["13 - 15 April 2027 | Pavilion 3, Crocus Expo | Moscow"]],
    ["a Russian value", "component", { Text1: "13–15 апреля 2027", Text2: "Москва, МВЦ «Крокус Экспо»" }, ["13–15 апреля 2027", "Москва, МВЦ «Крокус Экспо»"]],
    ["Text1 alone", "component", { Text1: "13 - 15 April 2027", Text2: null }, ["13 - 15 April 2027"]],
    ["Text2 alone", "component", { Text2: "Crocus Expo, Moscow" }, ["Crocus Expo, Moscow"]],
    ["a non-string Text1", "component", { Text1: 2027, Text2: "Crocus Expo, Moscow" }, ["Crocus Expo, Moscow"]],
    ["Markdown characters", "string", "Hall [3] \\ *East*", ["Hall [3] \\ *East*"]],
  ])("keeps %s verbatim apart from whitespace", async (_, navText, value, items) => {
    expect(await runNavText(navText, value)).toBe(
      `# Mosbuild 2026\n\n> The big show.\n\n${items.map((item) => `- ${item}`).join("\n")}\n\n${PAGES}`,
    );
    expect(errors).toEqual([]);
  });

  it.each([
    ["component", null],
    ["component", { Text1: "  ", Text2: "\n" }],
    ["component", { Text1: null, Text2: null }],
    ["string", null],
    ["string", "  \n \r\n "],
    ["string", 42],
  ])("writes no lines and says so when the %s NavText is %j", async (navText, value) => {
    expect(await runNavText(navText, value)).toBe(`# Mosbuild 2026\n\n> The big show.\n\n${PAGES}`);
    expect(errors).toEqual([
      "[llms.txt] The CMS returned no mosBuildNavBar.NavText text; llms.txt is written without the event date and location.",
    ]);
  });

  it("puts the lines right after the H1 when there is no description", async () => {
    const value = { Text1: "13 - 15 April 2027", Text2: "Crocus Expo, Moscow" };
    expect(await runNavText("component", value, undefined, { metaTitle: "Mosbuild 2026" })).toBe(
      `# Mosbuild 2026\n\n- 13 - 15 April 2027\n- Crocus Expo, Moscow\n\n${PAGES}`,
    );
  });

  it("keeps the lines when no link survives, ending the file after them", async () => {
    expect(await runNavText("string", "15-18 June 2027\nCrocus Expo, Moscow", [{ Title: "Shop", LinkTo: "https://shop.example.com/" }])).toBe(
      "# Mosbuild 2026\n\n> The big show.\n\n- 15-18 June 2027\n- Crocus Expo, Moscow\n",
    );
    expect(errors).toEqual([expect.stringContaining("has no links")]);
  });

  it.each([
    ["Component", '"Component"'],
    ["", '""'],
    [null, "null"],
    [1, "1"],
  ])("rejects navText %j before any request", async (navText, shown) => {
    const calls: Call[] = [];
    await expect(generateLlmsTxt({ ...OPTS, navText: navText as never, outDir: tmp(EXPORT), fetch: fakeFetch(CMS, calls) })).rejects.toThrow(
      `[llms.txt] navText must be "component" or "string", got ${shown}.`,
    );
    expect(calls).toEqual([]);
  });

  it.each([
    ["HTTP 400", false, 'failed with HTTP 400: Field "NavText" must not have a selection'],
    ["GraphQL errors", true, 'GraphQL errors: Field "NavText" must not have a selection'],
  ])("fails the build when the CMS has another NavText shape (%s)", async (_, ok, message) => {
    const body = { errors: [{ message: 'Field "NavText" must not have a selection since type "String" has no subfields.' }], data: null };
    const fetch = async () => ({ ok, status: ok ? 200 : 400, json: async () => body });
    await expect(generateLlmsTxt({ ...OPTS, navText: "component", outDir: tmp(EXPORT), fetch })).rejects.toThrow(message);
  });
});
