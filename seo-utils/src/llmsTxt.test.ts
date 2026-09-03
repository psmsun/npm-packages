import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateLlmsTxt, type LlmsTxtOptions } from "./llmsTxt.js";

// The legacy generator is CommonJS and reads the global fetch, so it is loaded with
// require() and run with fetch stubbed on globalThis.
const require = createRequire(import.meta.url);
const legacy = require("./__fixtures__/legacy-generateLlmsTxt.cjs") as {
  generateLlmsTxt: (opts: Omit<LlmsTxtOptions, "fetch">) => Promise<void>;
};

const SITE = "https://site.test";
const GRAPHQL = "https://ite-cms.test/graphql";
const OPTS = {
  siteUrl: SITE,
  strapiGraphqlUrl: GRAPHQL,
  homepageType: "mosBuildHomepage",
  navBarType: "mosBuildNavBar",
};

// Every nav shape the generator distinguishes: a top-level item with a direct link, a
// pure dropdown, an item with both, a link with no LinkTo, and absolute / leading-slash /
// bare paths, plus two items that must vanish entirely.
const NAV = [
  { Title: "Visit", LinkTo: "/visit", Links: [] },
  {
    Title: "Exhibit",
    LinkTo: null,
    Links: [
      { Text: "Why exhibit", LinkTo: "exhibit/why" },
      { Text: "Book a stand", LinkTo: "https://forms.example.com/stand" },
      { Text: "Coming soon", LinkTo: null },
    ],
  },
  {
    Title: "About",
    LinkTo: "about",
    Links: [{ Text: "Team", LinkTo: "/about/team" }],
  },
  { Title: "Empty", LinkTo: null, Links: [{ Text: "x", LinkTo: "" }] },
  { Title: "No links", LinkTo: null, Links: null },
];

const CMS = {
  data: {
    mosBuildHomepage: {
      seo: { metaTitle: "Mosbuild 2026", metaDescription: "The big show." },
    },
    mosBuildNavBar: { Data: NAV },
  },
};

const EXPECTED = `# Mosbuild 2026
> The big show.

## Key Sections

- Homepage: https://site.test/
- Visit: https://site.test/visit
- Exhibit
  - Why exhibit: https://site.test/exhibit/why
  - Book a stand: https://forms.example.com/stand
- About: https://site.test/about
  - Team: https://site.test/about/team
`;

type Call = { url: string; init: unknown };
function fakeFetch(payload: unknown, calls: Call[] = []) {
  return async (url: string, init: unknown) => {
    calls.push({ url, init });
    if (payload === "boom") throw new Error("network down");
    return { json: async () => payload };
  };
}

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "llms-"));
  dirs.push(d);
  return d;
}
const llms = (dir: string) => join(dir, "llms.txt");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("generateLlmsTxt", () => {
  it("writes byte-identical output and sends the identical request as the legacy generator", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const legacyCalls: Call[] = [];
    const portCalls: Call[] = [];
    vi.stubGlobal("fetch", fakeFetch(CMS, legacyCalls));

    const legacyDir = tmp();
    await legacy.generateLlmsTxt({ ...OPTS, outDir: legacyDir });
    const portDir = tmp();
    await generateLlmsTxt({ ...OPTS, outDir: portDir, fetch: fakeFetch(CMS, portCalls) });

    expect(readFileSync(llms(portDir))).toEqual(readFileSync(llms(legacyDir)));
    expect(portCalls).toEqual(legacyCalls);
    expect(portCalls).toHaveLength(1);
    expect(portCalls[0].url).toBe(GRAPHQL);
    expect(log).toHaveBeenNthCalledWith(1, "[llms.txt] generated →", `${legacyDir}/llms.txt`);
    expect(log).toHaveBeenNthCalledWith(2, "[llms.txt] generated →", `${portDir}/llms.txt`);
  });

  it("renders every nav shape the way the legacy generator did", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const dir = tmp();
    await generateLlmsTxt({ ...OPTS, outDir: dir, fetch: fakeFetch(CMS) });
    expect(readFileSync(llms(dir), "utf-8")).toBe(EXPECTED);
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

  it("creates the output directory when it does not exist yet", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const dir = join(tmp(), "out");
    expect(existsSync(dir)).toBe(false);
    await generateLlmsTxt({ ...OPTS, outDir: dir, fetch: fakeFetch(CMS) });
    expect(readFileSync(llms(dir), "utf-8")).toBe(EXPECTED);
  });

  it("uses the global fetch when none is injected", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const calls: Call[] = [];
    vi.stubGlobal("fetch", fakeFetch(CMS, calls));
    const dir = tmp();
    await generateLlmsTxt({ ...OPTS, outDir: dir });
    expect(calls).toHaveLength(1);
    expect(readFileSync(llms(dir), "utf-8")).toBe(EXPECTED);
  });

  it.each([
    ["no SEO record", { data: { mosBuildHomepage: null, mosBuildNavBar: { Data: NAV } } }],
    ["empty metaTitle", { data: { mosBuildHomepage: { seo: { metaTitle: "" } } } }],
    ["no data at all", {}],
  ])("skips with a warning and writes nothing when there is %s (legacy agrees)", async (_name, payload) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", fakeFetch(payload));

    const legacyDir = tmp();
    await legacy.generateLlmsTxt({ ...OPTS, outDir: legacyDir });
    const portDir = tmp();
    await generateLlmsTxt({ ...OPTS, outDir: portDir, fetch: fakeFetch(payload) });

    expect(existsSync(llms(legacyDir))).toBe(false);
    expect(existsSync(llms(portDir))).toBe(false);
    expect(warn.mock.calls).toEqual([
      ["[llms.txt] No SEO data found, skipping generation"],
      ["[llms.txt] No SEO data found, skipping generation"],
    ]);
    expect(error).not.toHaveBeenCalled();
  });

  it("swallows a thrown fetch, logs it and writes nothing (legacy agrees)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", fakeFetch("boom"));

    const legacyDir = tmp();
    await legacy.generateLlmsTxt({ ...OPTS, outDir: legacyDir });
    const portDir = tmp();
    await generateLlmsTxt({ ...OPTS, outDir: portDir, fetch: fakeFetch("boom") });

    expect(existsSync(llms(legacyDir))).toBe(false);
    expect(existsSync(llms(portDir))).toBe(false);
    expect(error.mock.calls).toEqual([
      ["[llms.txt] generation failed:", "network down"],
      ["[llms.txt] generation failed:", "network down"],
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs a malformed response body instead of throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const dir = tmp();
    await expect(
      generateLlmsTxt({
        ...OPTS,
        outDir: dir,
        fetch: async () => ({ json: async () => { throw new SyntaxError("Unexpected token <"); } }),
      }),
    ).resolves.toBeUndefined();
    expect(existsSync(llms(dir))).toBe(false);
    expect(error).toHaveBeenCalledWith("[llms.txt] generation failed:", "Unexpected token <");
  });
});
