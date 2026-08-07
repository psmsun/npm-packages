"use client";

import { useEffect, useState } from "react";

export interface FormContentFlags {
  /** The embed is a Yandex Cloud form rather than an ActiveCampaign one. */
  isYandexForm: boolean;
  /** The embed carries copy of its own (p/span/label), not just form controls. */
  isFormContent: boolean;
}

/**
 * Sniffs the CMS form markup for the two facts the wrapper needs to pick its
 * styling: which form provider it is, and whether it ships any copy.
 *
 * Both start `false` and settle after mount, since the parse needs a DOM.
 */
export function useFormContentFlags(html: string): FormContentFlags {
  const [isYandexForm, setIsYandexForm] = useState(false);
  const [isFormContent, setIsFormContent] = useState(false);

  useEffect(() => {
    // Check if content contains Yandex form
    setIsYandexForm(html.includes("yandexcloud"));

    // Create temporary div to parse HTML content
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    // Check for any HTML elements that indicate form content
    const hasFormElements = tempDiv.querySelectorAll("p,span,label").length > 0;
    setIsFormContent(hasFormElements);

    // Cleanup
    tempDiv.remove();
  }, [html]);

  return { isYandexForm, isFormContent };
}
