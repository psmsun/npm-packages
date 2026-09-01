/** A run of plain text between links. */
export interface TextToken {
  type: "text";
  value: string;
}

/** A `[label](url)` match. `offset` is its index in the source string. */
export interface LinkToken {
  type: "link";
  label: string;
  href: string;
  offset: number;
}

export type MarkdownToken = TextToken | LinkToken;

// [label](url) — the label stops at the first "]", the url at the first ")".
const LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

// A CMS editor has no reason to write these, and an <a> carrying one is an
// XSS vector on a public marketing page.
const UNSAFE_SCHEME = /^(?:javascript|vbscript|data):/i;

// Whitespace and control characters are stripped before the scheme test, since
// a browser ignores them inside a scheme but a naive regex does not:
// "java\tscript:alert(1)" is live in an href.
const IGNORED_IN_SCHEME = /[\s\u0000-\u001f\u007f]/gu;

const isUnsafe = (href: string): boolean =>
  UNSAFE_SCHEME.test(href.replace(IGNORED_IN_SCHEME, ""));

/**
 * Splits a plain-text CMS string into text runs and `[label](url)` links.
 *
 * Pure and framework-free: it never touches the DOM, resolves a URL, or decides
 * whether a link is internal. Callers render the tokens; `MarkdownLinks` does
 * that for React.
 *
 * A link with an unsafe scheme (`javascript:`, `data:`, `vbscript:`) is emitted
 * as literal text rather than a link, so it renders visibly instead of silently
 * becoming a live href.
 *
 * Newlines are preserved inside text tokens, so a `whitespace-pre-line` parent
 * still breaks lines exactly as it did before.
 */
export const parseMarkdownLinks = (text: unknown): MarkdownToken[] => {
  if (typeof text !== "string" || text === "") return [];

  const tokens: MarkdownToken[] = [];
  let lastIndex = 0;

  LINK.lastIndex = 0;
  let match = LINK.exec(text);

  while (match !== null) {
    const [full, label, href] = match;

    // Leave an unsafe link as raw "[label](url)"; the next text run absorbs it.
    if (!isUnsafe(href)) {
      if (match.index > lastIndex) {
        tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }

      tokens.push({ type: "link", label, href, offset: match.index });
      lastIndex = match.index + full.length;
    }

    match = LINK.exec(text);
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  return tokens;
};
