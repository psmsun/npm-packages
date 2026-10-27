import type { ElementType, ReactNode } from "react";
import { extendTailwindMerge } from "tailwind-merge";

export type TitleSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

export interface TitleProps {
  children?: ReactNode;
  pageHeader?: boolean;
  size?: TitleSize;
  className?: string;
  accentClassName?: string;
  as?: ElementType;
}

// Plain twMerge reads `text-size-*` as a colour and drops it next to `text-white`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            { size: ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"] },
          ],
        },
      ],
    },
  },
});

// Full literals: Tailwind finds class names by scanning dist/ as text.
const sizeClass: Record<TitleSize, string> = {
  "4xl": "text-size-4xl",
  "3xl": "text-size-3xl",
  "2xl": "text-size-2xl",
  xl: "text-size-xl",
  lg: "text-size-lg",
  md: "text-size-md",
  sm: "text-size-sm",
  xs: "text-size-xs",
};

const sizeTagMap: Record<TitleSize, ElementType> = {
  "4xl": "h2",
  "3xl": "h2",
  "2xl": "h2",
  xl: "h2",
  lg: "h3",
  md: "h4",
  sm: "h5",
  xs: "h6",
};

// Inline so a gradient-text size (background-clip:text, transparent fill) can't hide the accent.
const ACCENT_FILL = { WebkitTextFillColor: "currentColor" };

const accent = (
  text: string,
  marker: "//" | "##",
  key: number,
  className?: string,
) => (
  <span
    key={key}
    data-slot="title-accent"
    data-marker={marker}
    className={className}
    style={ACCENT_FILL}
  >
    {text}
  </span>
);

const renderMarkers = (
  text: string,
  accentClassName?: string,
): ReactNode[] => {
  const parts: ReactNode[] = [];
  let plain = "";

  const highlight = (word: string, marker: "//" | "##") => {
    if (plain) parts.push(plain);
    plain = "";
    parts.push(accent(word, marker, parts.length, accentClassName));
  };

  text.split("##").forEach((segment, index) => {
    // Even indexes are words (possibly empty at either end), odd indexes the whitespace between them.
    const tokens = segment.split(/(\s+)/);

    if (index % 2 === 1) {
      const run = tokens
        .map((token, i) =>
          i % 2 === 1
            ? tokens[i - 1] === "//"
              ? ""
              : token
            : token.startsWith("//")
              ? token.slice(2)
              : token,
        )
        .join("")
        .trim();
      if (run) highlight(run, "##");
      return;
    }

    let lastWord = -1;
    tokens.forEach((token, i) => {
      if (i % 2 === 0 && token) lastWord = i;
    });

    let highlightNext = false;
    tokens.forEach((token, i) => {
      if (i % 2 === 1) {
        const afterMarker = tokens[i - 1] === "//" && i - 1 !== lastWord;
        const beforeLastMarker = tokens[i + 1] === "//" && i + 1 === lastWord;
        if (!afterMarker && !beforeLastMarker) plain += token;
        return;
      }
      if (token === "//") {
        highlightNext = true;
        return;
      }
      if (!token) return;
      const glued = token.startsWith("//");
      if (glued || highlightNext) highlight(glued ? token.slice(2) : token, "//");
      else plain += token;
      highlightNext = false;
    });
  });

  if (plain) parts.push(plain);
  return parts;
};

const textOf = (children: ReactNode): string | null => {
  if (typeof children === "string") return children;
  if (!Array.isArray(children)) return null;
  const items = children.filter(
    (child) => child != null && typeof child !== "boolean",
  );
  return items.every(
    (child) => typeof child === "string" || typeof child === "number",
  )
    ? items.join("")
    : null;
};

export const Title = ({
  children,
  pageHeader = false,
  size = "xl",
  className,
  accentClassName,
  as,
}: TitleProps) => {
  if (!children && children !== 0) return null;
  const text = textOf(children);
  const parts = text === null ? null : renderMarkers(text, accentClassName);
  if (parts && !parts.some((part) => typeof part !== "string" || part.trim()))
    return null;

  const Tag = pageHeader ? "h1" : (as ?? sizeTagMap[size]);
  const content = parts ?? children;

  return (
    <Tag
      data-slot="title"
      data-size={size}
      className={twMerge(sizeClass[size], className)}
    >
      {content}
    </Tag>
  );
};
