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

type Word = { text: string; marker?: "//" | "##" };

const renderMarkers = (
  text: string,
  accentClassName?: string,
): ReactNode[] => {
  const words: Word[] = [];

  text.split("##").forEach((segment, index) => {
    if (index % 2 === 1) {
      const highlighted = segment
        .split(/\s+/)
        .map((token) => (token.startsWith("//") ? token.slice(2) : token))
        .filter(Boolean)
        .join(" ");
      if (highlighted) words.push({ text: highlighted, marker: "##" });
      return;
    }

    let highlightNext = false;
    for (const token of segment.split(/\s+/)) {
      if (!token) continue;
      if (token === "//") {
        highlightNext = true;
        continue;
      }
      const glued = token.startsWith("//");
      words.push({
        text: glued ? token.slice(2) : token,
        marker: highlightNext || glued ? "//" : undefined,
      });
      highlightNext = false;
    }
  });

  const parts: ReactNode[] = [];
  let plain = "";

  words.forEach((word, index) => {
    const separator = index === 0 ? "" : " ";
    if (!word.marker) {
      plain += separator + word.text;
      return;
    }
    plain += separator;
    if (plain) parts.push(plain);
    plain = "";
    parts.push(accent(word.text, word.marker, index, accentClassName));
  });
  if (plain) parts.push(plain);

  return parts;
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
  if (typeof children === "string" && !children.trim()) return null;

  const Tag = pageHeader ? "h1" : (as ?? sizeTagMap[size]);
  const content =
    typeof children === "string" && /\/\/|##/.test(children)
      ? renderMarkers(children, accentClassName)
      : children;
  if (Array.isArray(content) && !content.length) return null;

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
