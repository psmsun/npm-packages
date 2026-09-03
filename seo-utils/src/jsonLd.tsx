/**
 * Renders CMS `seo.JSON_LD` as application/ld+json in the document head.
 * Uses a plain <script> tag so App Router can hoist it server-side (no next/script).
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

export function JsonLd({ seo }: { seo?: CmsSeoJsonLd }) {
  const innerHtmls = getStructuredDataScriptInnerHtmls(seo?.JSON_LD);
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
