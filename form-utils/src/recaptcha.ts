export const RECAPTCHA_NET_HOST = "www.recaptcha.net";

export function rewriteRecaptchaHost(html: string, host: string = RECAPTCHA_NET_HOST): string {
  if (typeof html !== "string") return html;
  return html.split("www.google.com/recaptcha/").join(`${host}/recaptcha/`);
}

// Each "<script" scan stops at the next "<" outside a quoted value, so the check stays linear.
const SIMPLE_EMBED_LOADER =
  /<script(?=[\s/>])(?:[^<>"']|"[^"]*"|'[^']*')*?\ssrc\s*=\s*["']?[^"'\s>?#]*\/f\/embed\.php(?=[?#"'\s>]|$)/i;

export function isActiveCampaignSimpleEmbed(html: string): boolean {
  return typeof html === "string" && SIMPLE_EMBED_LOADER.test(html);
}
