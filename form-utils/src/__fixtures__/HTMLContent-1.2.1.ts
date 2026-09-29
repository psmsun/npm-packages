"use client";
import { createElement, useEffect, useRef } from "react";

// thats the original code from dangerously-set-html-content package but slightly modified to work with react 19+ and next.js 15+

export interface HTMLContentProps {
  html: string;
  allowRerender?: boolean;
  className?: string;
  [key: string]: any;
}

export function HTMLContent({
  html,
  allowRerender = false,
  ...rest
}: HTMLContentProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!html || !divRef.current) {
      console.error("html prop can't be null");
      return;
    }

    // Skip re-render if allowRerender is false and it's not the first render
    if (!isFirstRender.current && !allowRerender) return;

    isFirstRender.current = false;

    // Create a 'tiny' document and parse the html string
    const slotHtml = document.createRange().createContextualFragment(html);

    // Clear the container
    divRef.current.innerHTML = "";

    // Append the new content
    divRef.current.appendChild(slotHtml);
  }, [html, allowRerender]);

  return createElement("div", { ...rest, ref: divRef });
}

export default HTMLContent;
