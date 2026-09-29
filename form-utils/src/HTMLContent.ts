"use client";
import { createElement, useEffect, useRef } from "react";
import { isActiveCampaignSimpleEmbed, rewriteRecaptchaHost } from "./recaptcha.js";

// thats the original code from dangerously-set-html-content package but slightly modified to work with react 19+ and next.js 15+

export interface HTMLContentProps {
  html: string;
  allowRerender?: boolean;
  className?: string;
  recaptchaHost?: string;
  [key: string]: any;
}

function simpleEmbedMessage(id: unknown, recaptchaHost: string): string {
  const form = id == null ? "A form" : `Form ${JSON.stringify(id)}`;
  return `[form] ${form} is an ActiveCampaign simple embed (embed.php): its reCAPTCHA host cannot be switched to ${recaptchaHost}. Use the full embed code.`;
}

export function HTMLContent({
  html,
  allowRerender = false,
  recaptchaHost,
  ...rest
}: HTMLContentProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const loggedHtml = useRef<string | null>(null);

  if (typeof window === "undefined" && recaptchaHost && isActiveCampaignSimpleEmbed(html)) {
    console.error(simpleEmbedMessage(rest.id, recaptchaHost));
  }

  useEffect(() => {
    if (!recaptchaHost || !isActiveCampaignSimpleEmbed(html) || loggedHtml.current === html) return;
    loggedHtml.current = html;
    console.error(simpleEmbedMessage(rest.id, recaptchaHost));
  }, [html, recaptchaHost]);

  useEffect(() => {
    if (!html || !divRef.current) {
      console.error("html prop can't be null");
      return;
    }

    // Skip re-render if allowRerender is false and it's not the first render
    if (!isFirstRender.current && !allowRerender) return;

    isFirstRender.current = false;

    // Create a 'tiny' document and parse the html string
    const slotHtml = document
      .createRange()
      .createContextualFragment(recaptchaHost ? rewriteRecaptchaHost(html, recaptchaHost) : html);

    // Clear the container
    divRef.current.innerHTML = "";

    // Append the new content
    divRef.current.appendChild(slotHtml);
  }, [html, allowRerender, recaptchaHost]);

  return createElement("div", { ...rest, ref: divRef });
}

export default HTMLContent;
