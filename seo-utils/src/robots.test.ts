import { describe, expect, it } from "vitest";
import { contentSignalRobotsTxt, DEFAULT_CONTENT_SIGNAL } from "./robots.js";

// What next-sitemap emits for the fleet's config (generateRobotsTxt: true, no policies).
const ROBOTS = `# *
User-agent: *
Allow: /

# Host
Host: https://expopharmtech.com

# Sitemaps
Sitemap: https://expopharmtech.com/sitemap.xml
`;

// The inline block every next-sitemap.config.js carried before 1.1.0, verbatim.
const inline = async (_config: unknown, robotsTxt: string) =>
  robotsTxt.replace(
    "User-agent: *\n",
    "User-agent: *\nContent-Signal: search=yes, ai-input=yes, ai-train=no\n",
  );

describe("contentSignalRobotsTxt", () => {
  it("produces exactly what the inline transform produced", async () => {
    const config = { siteUrl: "https://expopharmtech.com" };
    expect(await contentSignalRobotsTxt()(config, ROBOTS)).toBe(await inline(config, ROBOTS));
  });

  it("injects the default signal directly under User-agent: *", async () => {
    expect(await contentSignalRobotsTxt()(undefined, ROBOTS)).toBe(`# *
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /

# Host
Host: https://expopharmtech.com

# Sitemaps
Sitemap: https://expopharmtech.com/sitemap.xml
`);
    expect(DEFAULT_CONTENT_SIGNAL).toBe("search=yes, ai-input=yes, ai-train=no");
  });

  it("accepts a custom signal", async () => {
    const out = await contentSignalRobotsTxt("search=yes, ai-input=no, ai-train=no")(undefined, ROBOTS);
    expect(out).toContain("User-agent: *\nContent-Signal: search=yes, ai-input=no, ai-train=no\nAllow: /\n");
    expect(out).not.toContain("ai-input=yes");
  });

  it("is a no-op when there is no User-agent: * group", async () => {
    const other = "User-agent: Googlebot\nAllow: /\n";
    expect(await contentSignalRobotsTxt()(undefined, other)).toBe(other);
    expect(await contentSignalRobotsTxt()(undefined, "")).toBe("");
  });

  it("only touches the first User-agent: * group, like the inline replace", async () => {
    const twice = "User-agent: *\nAllow: /\n\nUser-agent: *\nDisallow: /x\n";
    expect(await contentSignalRobotsTxt()(undefined, twice)).toBe(await inline(undefined, twice));
    expect((await contentSignalRobotsTxt()(undefined, twice)).match(/Content-Signal/g)).toHaveLength(1);
  });

  it("returns a promise, as next-sitemap awaits the hook", () => {
    expect(contentSignalRobotsTxt()(undefined, ROBOTS)).toBeInstanceOf(Promise);
  });
});
