/**
 * Renders CMS `seo.JSON_LD` as application/ld+json.
 * Mirrors turtle-bay / Prismetic: parse string/object/array, re-stringify, escape `<` for inline scripts.
 */

export type CmsSeoJsonLd =
  | {
      JSON_LD?: unknown;
    }
  | null
  | undefined;

function escapeForInlineScriptJson(json: string): string {
  return json.replace(/</g, "\\u003c");
}

function payloadsFromRaw(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    const trimmed = raw.trim().replace(/^\uFEFF/, "");
    if (!trimmed) return [];
    try {
      return payloadsFromRaw(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter((item) => item != null && typeof item === "object");
  }
  if (typeof raw === "object") {
    if (raw instanceof Date) return [];
    return [raw];
  }
  return [];
}

export function getStructuredDataScriptInnerHtmls(
  jsonLdField: unknown,
): string[] {
  const payloads = payloadsFromRaw(jsonLdField);
  const out: string[] = [];
  for (const payload of payloads) {
    try {
      out.push(escapeForInlineScriptJson(JSON.stringify(payload)));
    } catch {
      // skip invalid payload
    }
  }
  return out;
}

export function JsonLd({ seo }: { seo?: unknown }) {
  const rawLd =
    seo && typeof seo === "object" && "JSON_LD" in seo
      ? (seo as { JSON_LD?: unknown }).JSON_LD
      : undefined;
  const innerHtmls = getStructuredDataScriptInnerHtmls(rawLd);
  if (innerHtmls.length === 0) return null;

  return (
    <>
      {innerHtmls.map((html, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ))}
    </>
  );
}
