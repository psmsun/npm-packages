export const RECAPTCHA_NET_HOST = "www.recaptcha.net";

export function rewriteRecaptchaHost(html: string, host: string = RECAPTCHA_NET_HOST): string {
  if (typeof html !== "string") return html;
  return html.split("www.google.com/recaptcha/").join(`${host}/recaptcha/`);
}

export function isActiveCampaignSimpleEmbed(html: string): boolean {
  return typeof html === "string" && html.includes("/f/embed.php");
}
