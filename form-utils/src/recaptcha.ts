export const RECAPTCHA_NET_HOST = "www.recaptcha.net";

export function rewriteRecaptchaHost(html: string, host: string = RECAPTCHA_NET_HOST): string {
  if (typeof html !== "string") return html;
  return html.split("www.google.com/recaptcha/").join(`${host}/recaptcha/`);
}

const SCRIPT_START_TAG = /<script(?=[\t\n\f\r />])/gi;
const ATTRIBUTE =
  /[\t\n\f\r /]*([^\t\n\f\r />][^\t\n\f\r />=]*)(?:[\t\n\f\r ]*=[\t\n\f\r ]*(?:"([^"]*)"?|'([^']*)'?|([^\t\n\f\r >]*)))?/y;
const LOADER_PATH = /^[^?#]*\/f\/embed\.php(?:[?#]|$)/i;

export function isActiveCampaignSimpleEmbed(html: string): boolean {
  if (typeof html !== "string") return false;
  SCRIPT_START_TAG.lastIndex = 0;
  while (SCRIPT_START_TAG.exec(html)) {
    let srcSeen = false;
    ATTRIBUTE.lastIndex = SCRIPT_START_TAG.lastIndex;
    for (let attribute; (attribute = ATTRIBUTE.exec(html)); ) {
      // The next "<script" search starts after this tag, so the check stays linear.
      SCRIPT_START_TAG.lastIndex = ATTRIBUTE.lastIndex;
      if (srcSeen || attribute[1].toLowerCase() !== "src") continue;
      srcSeen = true;
      if (LOADER_PATH.test((attribute[2] ?? attribute[3] ?? attribute[4] ?? "").trim())) return true;
    }
  }
  return false;
}
