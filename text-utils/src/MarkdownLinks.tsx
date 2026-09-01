import type { ComponentType, ElementType, ReactNode } from "react";
import { Fragment } from "react";
import { parseMarkdownLinks } from "./parseMarkdownLinks.js";

/**
 * Anything that renders an anchor from an `href`. A site passes its own
 * NavigationLink so every CMS link rule it already implements — bare domains,
 * external targets, `rel`, static-file prefetch — applies here too.
 */
export type LinkComponent =
  | ElementType
  | ComponentType<{ href: string; className?: string; children: ReactNode }>;

export interface MarkdownLinksProps {
  /** The raw CMS string. Anything that is not a string renders as nothing. */
  text: unknown;
  /** Renders each link. Defaults to a plain `<a>`. */
  link?: LinkComponent;
  /** Class applied to every link. */
  className?: string;
}

/**
 * Renders `[label](url)` inside a plain-text CMS field as real links, leaving
 * the surrounding text untouched.
 *
 * This is deliberately NOT a hook: it renders in server components and is safe
 * to use inside a `.map()`, which a `useMarkdownLinks` hook would not be.
 *
 * It performs no URL handling of its own — every href goes straight to `link`.
 * Pass the site's own link component so the fleet's resolution rules stay in
 * one place. The only href it inspects is an unsafe scheme, which
 * `parseMarkdownLinks` keeps as literal text.
 *
 * Text with no links renders as the bare string, so a field that never contains
 * a link produces exactly the DOM it did before.
 */
export const MarkdownLinks = ({
  text,
  link: Link = "a",
  className = "underline",
}: MarkdownLinksProps) => {
  const tokens = parseMarkdownLinks(text);

  if (tokens.length === 0) return null;
  if (tokens.length === 1 && tokens[0].type === "text") return tokens[0].value;

  return (
    <>
      {tokens.map((token, i) =>
        token.type === "text" ? (
          // Tokens are derived deterministically from `text` and never
          // reordered, so the index is a stable key here.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <Fragment key={i}>{token.value}</Fragment>
        ) : (
          <Link key={token.offset} href={token.href} className={className}>
            {token.label}
          </Link>
        ),
      )}
    </>
  );
};

export default MarkdownLinks;
