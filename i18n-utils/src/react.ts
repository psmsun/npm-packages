"use client";

import {
  createContext,
  createElement,
  type FocusEventHandler,
  type MouseEventHandler,
  type PointerEventHandler,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
  useContext,
  useEffect,
  useState,
} from "react";
import { htmlLangOf, type LocalesConfig, localeFromPath } from "./index.js";

export interface LocaleSwitchOptions {
  hreflang: string;
  fallback: string;
  pathname?: string | null;
}

export interface LocaleSwitchLinkProps {
  href: string;
  hrefLang: string;
  lang: string;
  onPointerDown: PointerEventHandler<HTMLAnchorElement>;
  onFocus: FocusEventHandler<HTMLAnchorElement>;
  onClick: MouseEventHandler<HTMLAnchorElement>;
}

export interface LocaleSwitch {
  href: string;
  linkProps: LocaleSwitchLinkProps;
}

const LocaleContext = createContext("");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}): ReactElement {
  return createElement(LocaleContext.Provider, { value: locale }, children);
}

export function useLocale<L extends string = string>(): L {
  return useContext(LocaleContext) as L;
}

export function PathLocaleProvider({
  config,
  children,
}: {
  config: LocalesConfig;
  children: ReactNode;
}): ReactElement {
  const [locale, setLocale] = useState(config.defaultLocale);

  useEffect(() => {
    const detected = localeFromPath(config, window.location.pathname);
    document.documentElement.lang = htmlLangOf(config, detected);
    setLocale(detected);
  }, [config]);

  return createElement(LocaleContext.Provider, { value: locale }, children);
}

function alternatePath(hreflang: string, fallback: string): string {
  const href = document
    .querySelector(`link[rel="alternate"][hreflang="${hreflang.replace(/["\\]/g, "\\$&")}"]`)
    ?.getAttribute("href");
  if (!href) return fallback;
  try {
    return new URL(href, document.baseURI).pathname;
  } catch {
    return fallback;
  }
}

export function useLocaleSwitch({ hreflang, fallback, pathname }: LocaleSwitchOptions): LocaleSwitch {
  const [href, setHref] = useState(fallback);

  useEffect(() => {
    setHref(alternatePath(hreflang, fallback));
  }, [hreflang, fallback, pathname]);

  // Client navigation swaps the head after the effect ran, so read it again as the link is used.
  const refresh = (event: SyntheticEvent<HTMLAnchorElement>) => {
    const next = alternatePath(hreflang, fallback);
    event.currentTarget.href = next;
    setHref(next);
  };

  return {
    href,
    linkProps: {
      href,
      hrefLang: hreflang,
      lang: hreflang,
      onPointerDown: refresh,
      onFocus: refresh,
      onClick: refresh,
    },
  };
}
