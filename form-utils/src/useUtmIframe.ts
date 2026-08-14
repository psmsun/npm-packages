"use client";

import { useEffect } from "react";

/**
 * The slice of `URLSearchParams` this hook needs. Next's
 * `ReadonlyURLSearchParams` satisfies it, so the caller keeps the
 * `next/navigation` dependency and this package stays framework-neutral.
 */
export interface UtmSearchParams {
  get(name: string): string | null;
}

/**
 * Appends UTM params to an embedded CRM iframe's src and keeps its height in
 * sync with the `postMessage` the embed sends.
 *
 * UTMs come from the current URL when present, otherwise from the `utmParams`
 * entry in sessionStorage — so a visitor who lands on a campaign URL and then
 * navigates to the form still carries attribution.
 *
 * The embed injects its iframe asynchronously, so this retries across up to 40
 * animation frames rather than assuming the element is already there.
 *
 * @param formId     id of the iframe element the embed renders
 * @param searchParams current query params (e.g. Next's `useSearchParams()`)
 * @param deps       extra values that should re-run the wiring
 */
export function useUtmIframe(
  formId: string | number | null | undefined,
  searchParams: UtmSearchParams,
  deps: unknown[] = [],
): void {
  useEffect(() => {
    if (!formId) return;

    const utmKeys = [
      "utm_campaign",
      "utm_content",
      "utm_medium",
      "utm_source",
      "utm_term",
    ] as const;

    const buildUtmQuery = () => {
      const fromUrl = utmKeys
        .map((key) => ({ key, value: searchParams.get(key) }))
        .filter(({ value }) => value !== null && value !== "");
      if (fromUrl.length > 0) {
        return fromUrl
          .map(
            ({ key, value }) => `${key}=${encodeURIComponent(value as string)}`,
          )
          .join("&");
      }
      const stored = sessionStorage.getItem("utmParams");
      if (!stored) return "";
      try {
        const obj = JSON.parse(stored) as Record<string, string>;
        return utmKeys
          .map((key) => ({ key, value: obj[key] }))
          .filter(({ value }) => value != null && value !== "")
          .map(
            ({ key, value }) => `${key}=${encodeURIComponent(value as string)}`,
          )
          .join("&");
      } catch {
        return "";
      }
    };

    const utmData = buildUtmQuery();
    const formIdStr = String(formId);

    const getIframe = () =>
      document.getElementById(formIdStr) as HTMLIFrameElement | null;

    const appendUtmToIframeSrc = (iframe: HTMLIFrameElement) => {
      if (!utmData || !iframe.src) return;
      const sep = iframe.src.includes("?") ? "&" : "?";
      iframe.src = `${iframe.src}${sep}${utmData}`;
    };

    let cancelled = false;
    let utmApplied = false;
    let attempts = 0;
    const maxAttempts = 40;

    const tryApplyUtms = () => {
      if (cancelled || !utmData || utmApplied) return;
      const iframe = getIframe();
      if (iframe?.src) {
        appendUtmToIframeSrc(iframe);
        utmApplied = true;
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryApplyUtms);
      }
    };

    tryApplyUtms();

    const handleMessage = (e: MessageEvent) => {
      const message = e.data;
      if (!message || typeof message !== "object") return;

      // Iframe height resize
      if ("height" in message) {
        const iframe = getIframe();
        if (iframe) {
          iframe.style.height = (message as { height: number }).height + "px";
        }
      }

      // Yandex Metrica goal — CRM sends { action: "form-sent", yandexCounterId, yandexCounterGoal }
      if (message.action === "form-sent") {
        try {
          (window as any).ym?.(
            message.yandexCounterId,
            "reachGoal",
            message.yandexCounterGoal,
          );
        } catch (_) {}
      }
    };
    window.addEventListener("message", handleMessage, false);
    return () => {
      cancelled = true;
      window.removeEventListener("message", handleMessage, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, searchParams, ...deps]);
}
