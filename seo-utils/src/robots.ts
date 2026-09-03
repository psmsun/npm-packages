/**
 * robots.txt Content-Signal (contentsignals.org): declares AI usage preferences to
 * compliant crawlers. The default keeps the site in search and AI-assistant answers,
 * lets assistants read pages to answer users, and withholds bulk model training.
 */

export const DEFAULT_CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";

/** Shape of next-sitemap's `robotsTxtOptions.transformRobotsTxt` hook. */
export type TransformRobotsTxt = (
  config: unknown,
  robotsTxt: string,
) => Promise<string>;

/**
 * Returns a next-sitemap `transformRobotsTxt` hook that injects
 * `Content-Signal: <signal>` under the `User-agent: *` group. Leaves robots.txt
 * untouched when that group is absent.
 */
export function contentSignalRobotsTxt(
  signal: string = DEFAULT_CONTENT_SIGNAL,
): TransformRobotsTxt {
  return async (_config, robotsTxt) =>
    robotsTxt.replace(
      "User-agent: *\n",
      `User-agent: *\nContent-Signal: ${signal}\n`,
    );
}
