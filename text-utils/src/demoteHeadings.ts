// A tag name ends only at tab, LF, FF, CR, space, "/" or ">", so <h10>, <header> and <h1-x> never match.
const H1_TAG = /<(\/?)h1(?=[\t\n\f\r />])/gi;

/** Renames every <h1> tag to <h2>. Not a sanitizer: the output is exactly as trusted as the input. */
export function demoteHeadings(html: string): string;
export function demoteHeadings<T>(html: T): T;
export function demoteHeadings(html: unknown): unknown {
  return typeof html === "string" ? html.replace(H1_TAG, "<$1h2") : html;
}
