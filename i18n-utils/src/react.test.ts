// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LocalesConfig } from "./index.js";
import {
  LocaleProvider,
  type LocaleSwitchOptions,
  PathLocaleProvider,
  useLocale,
  useLocaleSwitch,
} from "./react.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MOSBUILD: LocalesConfig = {
  defaultLocale: "en",
  locales: {
    en: { prefix: "", ogLocale: "en_US", hreflang: ["en"], htmlLang: "en", label: "EN" },
    "zh-CN": { prefix: "cn", ogLocale: "zh_CN", hreflang: ["zh-CN", "zh"], htmlLang: "zh-CN", label: "中文" },
  },
};

let container: HTMLDivElement;
let root: Root;
let seen: string[];

function Probe() {
  seen.push(useLocale());
  return null;
}

function render(node: ReactNode) {
  act(() => root.render(node));
}

function setAlternate(hreflang: string, href: string) {
  document.head.querySelector(`link[hreflang="${hreflang}"]`)?.remove();
  const link = document.createElement("link");
  link.rel = "alternate";
  link.setAttribute("hreflang", hreflang);
  link.href = href;
  document.head.append(link);
}

beforeEach(() => {
  seen = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.head.innerHTML = "";
  document.documentElement.lang = "";
  window.history.replaceState(null, "", "/");
});

describe("LocaleProvider and useLocale", () => {
  it("provides the locale", () => {
    render(createElement(LocaleProvider, { locale: "zh-CN", children: createElement(Probe) }));
    expect(seen).toEqual(["zh-CN"]);
  });

  it('returns "" outside a provider instead of throwing', () => {
    render(createElement(Probe));
    expect(seen).toEqual([""]);
  });
});

describe("PathLocaleProvider", () => {
  const renderAt = (path: string, config: LocalesConfig = MOSBUILD) => {
    window.history.replaceState(null, "", path);
    render(createElement(PathLocaleProvider, { config, children: createElement(Probe) }));
  };

  it("provides the default before mount and the path's locale after", () => {
    renderAt("/cn/missing-page/");
    expect(seen).toEqual(["en", "zh-CN"]);
    expect(document.documentElement.lang).toBe("zh-CN");
  });

  it("stays on the default for an English path", () => {
    renderAt("/missing-page/");
    expect(seen).toEqual(["en"]);
    expect(document.documentElement.lang).toBe("en");
  });

  it("ignores a disabled locale's prefix", () => {
    renderAt("/cn/missing-page/", {
      ...MOSBUILD,
      locales: { ...MOSBUILD.locales, "zh-CN": { ...MOSBUILD.locales["zh-CN"], enabled: false } },
    });
    expect(seen).toEqual(["en"]);
    expect(document.documentElement.lang).toBe("en");
  });

  it("sets <html lang> from htmlLang and provides the locale key", () => {
    renderAt("/cn/x/", {
      ...MOSBUILD,
      locales: { ...MOSBUILD.locales, "zh-CN": { ...MOSBUILD.locales["zh-CN"], htmlLang: "zh-Hans" } },
    });
    expect(seen.at(-1)).toBe("zh-CN");
    expect(document.documentElement.lang).toBe("zh-Hans");
  });
});

describe("useLocaleSwitch", () => {
  function Switch(props: LocaleSwitchOptions) {
    const { linkProps } = useLocaleSwitch(props);
    return createElement("a", linkProps, "中文");
  }

  const ZH = { hreflang: "zh-CN", fallback: "/cn/" };
  const anchor = () => container.querySelector("a")!;

  it("links to the pathname of the page's own alternate", () => {
    setAlternate("en", "https://mosbuildexpo.com/articles/a/");
    setAlternate("zh-CN", "https://mosbuildexpo.com/cn/articles/b/");
    render(createElement(Switch, { ...ZH, pathname: "/articles/a/" }));
    expect(anchor().getAttribute("href")).toBe("/cn/articles/b/");
    expect(anchor().getAttribute("hreflang")).toBe("zh-CN");
    expect(anchor().getAttribute("lang")).toBe("zh-CN");
  });

  it("keeps a preview host on its own origin", () => {
    setAlternate("zh-CN", "https://preview.mosbuildexpo.com/cn/articles/b/");
    render(createElement(Switch, { ...ZH, pathname: "/articles/a/" }));
    expect(anchor().getAttribute("href")).toBe("/cn/articles/b/");
  });

  it("falls back without a matching alternate", () => {
    setAlternate("en", "https://mosbuildexpo.com/articles/a/");
    render(createElement(Switch, { ...ZH, pathname: "/articles/a/" }));
    expect(anchor().getAttribute("href")).toBe("/cn/");
  });

  it("renders the fallback before mount", () => {
    setAlternate("zh-CN", "https://mosbuildexpo.com/cn/articles/b/");
    const hrefs: string[] = [];
    function Spy() {
      hrefs.push(useLocaleSwitch({ ...ZH, pathname: "/articles/a/" }).href);
      return null;
    }
    render(createElement(Spy));
    expect(hrefs).toEqual(["/cn/", "/cn/articles/b/"]);
  });

  it("re-reads when the pathname changes", () => {
    setAlternate("zh-CN", "https://mosbuildexpo.com/cn/articles/b/");
    render(createElement(Switch, { ...ZH, pathname: "/articles/a/" }));
    setAlternate("zh-CN", "https://mosbuildexpo.com/cn/articles/d/");
    render(createElement(Switch, { ...ZH, pathname: "/articles/c/" }));
    expect(anchor().getAttribute("href")).toBe("/cn/articles/d/");
  });

  describe("with the head swapped between render and use", () => {
    beforeEach(() => {
      setAlternate("zh-CN", "https://mosbuildexpo.com/cn/articles/b/");
      render(createElement(Switch, { ...ZH, pathname: "/articles/a/" }));
      setAlternate("zh-CN", "https://mosbuildexpo.com/cn/articles/d/");
      render(createElement(Switch, { ...ZH, pathname: "/articles/a/" }));
      expect(anchor().getAttribute("href")).toBe("/cn/articles/b/");
    });

    it("rewrites href on pointerdown", () => {
      act(() => {
        anchor().dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      });
      expect(anchor().getAttribute("href")).toBe("/cn/articles/d/");
    });

    it("rewrites href on focus", () => {
      act(() => {
        anchor().dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      });
      expect(anchor().getAttribute("href")).toBe("/cn/articles/d/");
    });

    it("rewrites href on click, before the browser follows it", () => {
      let followed: string | null = null;
      const follow = (event: Event) => {
        followed = (event.target as HTMLAnchorElement).getAttribute("href");
        event.preventDefault();
      };
      window.addEventListener("click", follow);
      try {
        act(() => {
          anchor().dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        });
      } finally {
        window.removeEventListener("click", follow);
      }
      expect(followed).toBe("/cn/articles/d/");
      expect(anchor().getAttribute("href")).toBe("/cn/articles/d/");
    });
  });
});

describe("useLocaleSwitch lang", () => {
  function Switch(props: LocaleSwitchOptions) {
    return createElement("a", useLocaleSwitch(props).linkProps, "中文");
  }

  const anchor = () => container.querySelector("a")!;

  it("sets the link's lang from lang and keeps hreflang for hrefLang", () => {
    setAlternate("zh-CN", "https://mosbuildexpo.com/cn/articles/b/");
    render(createElement(Switch, { hreflang: "zh-CN", fallback: "/cn/", pathname: "/articles/a/", lang: "zh-Hans" }));
    expect(anchor().getAttribute("lang")).toBe("zh-Hans");
    expect(anchor().getAttribute("hreflang")).toBe("zh-CN");
    expect(anchor().getAttribute("href")).toBe("/cn/articles/b/");
  });

  it.each([
    ["left out", {}],
    ["undefined", { lang: undefined }],
  ])("returns the 0.1.0 link props when lang is %s", (_, extra) => {
    const results: ReturnType<typeof useLocaleSwitch>[] = [];
    function Spy() {
      results.push(useLocaleSwitch({ hreflang: "zh-CN", fallback: "/cn/", pathname: "/articles/a/", ...extra }));
      return null;
    }
    render(createElement(Spy));
    const { linkProps } = results.at(-1)!;
    expect(Object.keys(linkProps)).toEqual(["href", "hrefLang", "lang", "onPointerDown", "onFocus", "onClick"]);
    expect(linkProps).toMatchObject({ href: "/cn/", hrefLang: "zh-CN", lang: "zh-CN" });
  });
});
