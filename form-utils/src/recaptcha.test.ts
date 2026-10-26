import { describe, expect, test } from "vitest";
import { isActiveCampaignSimpleEmbed, RECAPTCHA_NET_HOST, rewriteRecaptchaHost } from "./recaptcha.js";

const SCRIPT_SRC = `<script src="https://www.google.com/recaptcha/api.js?onload=recaptcha_callback&render=explicit" async defer></script>`;
const INLINE = `<script>var s = document.createElement("script"); s.src = 'https://www.google.com/recaptcha/api.js'; document.head.appendChild(s);</script>`;
const FULL_EMBED = `<form method="POST" action="https://itegroup.activehosted.com/proc.php" id="_form_12_" class="_form _form_12 _inline-form"><input type="hidden" name="u" value="12" /><div class="g-recaptcha" data-sitekey="6LcwIw8TAAAAACP1ysM08EhCgzd6q5JAOUR1a0Go"></div><button id="_form_12_submit" class="_submit" type="submit">Submit</button></form>${SCRIPT_SRC}`;
const SIMPLE_EMBED = `<div class="_form_12"></div><script src="https://itegroup.activehosted.com/f/embed.php?id=12" type="text/javascript" charset="utf-8"></script>`;

describe("rewriteRecaptchaHost", () => {
  test("defaults to www.recaptcha.net", () => {
    expect(RECAPTCHA_NET_HOST).toBe("www.recaptcha.net");
  });

  test("rewrites a script src", () => {
    expect(rewriteRecaptchaHost(SCRIPT_SRC)).toBe(
      `<script src="https://www.recaptcha.net/recaptcha/api.js?onload=recaptcha_callback&render=explicit" async defer></script>`,
    );
  });

  test("rewrites a string inside an inline script", () => {
    expect(rewriteRecaptchaHost(INLINE)).toBe(
      `<script>var s = document.createElement("script"); s.src = 'https://www.recaptcha.net/recaptcha/api.js'; document.head.appendChild(s);</script>`,
    );
  });

  test("rewrites every occurrence", () => {
    const html = `${SCRIPT_SRC}${INLINE}<a href="https://www.google.com/recaptcha/admin">x</a>`;
    const out = rewriteRecaptchaHost(html);
    expect(out).not.toContain("www.google.com/recaptcha/");
    expect(out.split("www.recaptcha.net/recaptcha/")).toHaveLength(4);
  });

  test("returns HTML without an occurrence unchanged", () => {
    expect(rewriteRecaptchaHost(SIMPLE_EMBED)).toBe(SIMPLE_EMBED);
    expect(rewriteRecaptchaHost("")).toBe("");
  });

  test("uses a custom host", () => {
    expect(rewriteRecaptchaHost(SCRIPT_SRC, "recaptcha.example.cn")).toContain(
      "https://recaptcha.example.cn/recaptcha/api.js?onload",
    );
  });

  test("touches nothing else on google.com", () => {
    const html = `<script src="https://www.google.com/maps/api/js"></script><link href="https://fonts.googleapis.com/css2"><script src="https://google.com/recaptcha/api.js"></script><img src="https://www.google.com/recaptchalogo.png"><script src="https://www.gstatic.com/recaptcha/releases/x/recaptcha__en.js"></script>`;
    expect(rewriteRecaptchaHost(html)).toBe(html);
  });

  test("returns a non-string as is", () => {
    expect(rewriteRecaptchaHost(null as never)).toBeNull();
    expect(rewriteRecaptchaHost(undefined as never)).toBeUndefined();
    expect(rewriteRecaptchaHost(12 as never)).toBe(12);
  });
});

describe("isActiveCampaignSimpleEmbed", () => {
  test("finds the embed.php loader", () => {
    expect(isActiveCampaignSimpleEmbed(SIMPLE_EMBED)).toBe(true);
    expect(isActiveCampaignSimpleEmbed(`<script src='https://forms.example.com/f/embed.php?id=3'></script>`)).toBe(true);
  });

  test.each([
    ["the full embed code", FULL_EMBED],
    ["a Yandex form", `<script src="https://forms.yandexcloud.net/_static/embed.js"></script><iframe src="https://forms.yandexcloud.net/abc?iframe=1"></iframe>`],
    ["an empty string", ""],
    ["null", null],
    ["undefined", undefined],
  ])("is false for %s", (_, html) => {
    expect(isActiveCampaignSimpleEmbed(html as never)).toBe(false);
  });

  test.each([
    ["embed.php without /f/", `<script src="https://itegroup.activehosted.com/embed.php?id=12"></script>`],
    ["the text embed.php in visible copy", `<p>Paste the embed.php snippet into the CMS.</p>`],
    ["the loader path in visible copy", `<p>Paste /f/embed.php here</p>`],
    ["a longer file name", `<script src="https://itegroup.activehosted.com/f/embed.php-not-a-loader.js"></script>`],
    ["the path in another element's src", `<iframe src="https://itegroup.activehosted.com/f/embed.php?id=12"></iframe>`],
    ["the path in a data- attribute", `<script data-src="https://itegroup.activehosted.com/f/embed.php?id=12"></script>`],
    ["the path in the query string", `<script src="https://example.com/loader.js?next=/f/embed.php"></script>`],
    ["a src inside another attribute's quoted value", `<script data-note=" src=/f/embed.php " src="/ordinary.js"></script>`],
    ["a tag name that only starts with script", `<script-widget src="/f/embed.php"></script-widget>`],
    ["the path as another attribute's unquoted value", `<script data-note= src=/f/embed.php></script>`],
    ["the path in a second src", `<script src="/x.js" src="/f/embed.php">`],
    ["a <script tag inside another attribute's quoted value", `<script data-x="<script src=/f/embed.php>" src="/x.js"></script>`],
  ])("is false for %s", (_, html) => {
    expect(isActiveCampaignSimpleEmbed(html)).toBe(false);
  });

  test.each([
    ["a > inside an earlier quoted value", `<script data-note="a > b" src="/f/embed.php"></script>`],
    ["a < inside an earlier quoted value", `<script data-x="a<b" src="/f/embed.php">`],
    ["a single-quoted relative src and no closing tag", `<script src='/f/embed.php?id=1'>`],
    ["an apostrophe inside a double-quoted src", `<script src="/a'b/f/embed.php"></script>`],
    ["a leading space in the src value", `<script src=" /f/embed.php"></script>`],
    ["a trailing space in the src value", `<script src="/f/embed.php "></script>`],
    ["an upper-case SRC", `<script SRC="/f/embed.php"></script>`],
    ["the path in the first of two srcs", `<script src="/f/embed.php" src="/x.js">`],
  ])("finds the loader with %s", (_, html) => {
    expect(isActiveCampaignSimpleEmbed(html)).toBe(true);
  });

  test.each([
    ["a quote", `<script src="https://forms.example.com/f/embed.php"></script>`],
    ["#", `<script src="https://forms.example.com/f/embed.php#x"></script>`],
    ["whitespace", `<script src=https://forms.example.com/f/embed.php async></script>`],
    [">", `<script src=https://forms.example.com/f/embed.php></script>`],
    ["the end of the markup", `<script src=https://forms.example.com/f/embed.php`],
  ])("finds the loader path followed by %s", (_, html) => {
    expect(isActiveCampaignSimpleEmbed(html)).toBe(true);
  });

  test("is false for many unclosed <script tags", () => {
    expect(isActiveCampaignSimpleEmbed("<script ".repeat(30000))).toBe(false);
  });

  test("finds the loader with other attributes first, in any case", () => {
    expect(isActiveCampaignSimpleEmbed(`<SCRIPT type="text/javascript" SRC="https://itegroup.activehosted.com/f/embed.php?id=12"></SCRIPT>`)).toBe(true);
  });

  test("finds the loader on a custom ActiveCampaign domain", () => {
    expect(isActiveCampaignSimpleEmbed(`<script src="https://forms.itegroup.com/f/embed.php?id=12"></script>`)).toBe(true);
  });
});
