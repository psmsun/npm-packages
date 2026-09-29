# @prismetic/i18n-utils

> Built for Prismetic's ITE Strapi-backed Next.js sites. Extracted from Mosbuild's
> Chinese-locale pilot (`/cn/`), so a site adds a locale with config, not code.

One plain locale config per site, pure helpers for locale-aware paths, CMS
variables and typed dictionaries, and a React provider plus a language-switch hook.
Page metadata and hreflang live in
[`@prismetic/seo-utils/localized`](../seo-utils#entry-localized--metadata-per-locale-optional-prefix),
which reads the same config object.

## Install

```bash
npm install @prismetic/i18n-utils --save-exact
```

Two entries:

| Entry | Content | Loadable from |
| --- | --- | --- |
| `@prismetic/i18n-utils` | pure functions and types — no React import | Node, server and client |
| `@prismetic/i18n-utils/react` | `LocaleProvider`, `useLocale`, `PathLocaleProvider`, `useLocaleSwitch` — files start with `"use client"` | client |

## Requirements

| | |
| --- | --- |
| Peer | `react >=18`, for `./react` only. `Context.Provider` is used, not React 19's `<Context>` |
| Dependencies | none |
| Next.js | not a peer dep, never imported. The site passes `usePathname()` in |
| Module format | ESM. `require()` works from CommonJS through Node's `require(esm)` (Node 20.19+ / 22.12+) |
| Side effects | none at import; `package.json` declares `"sideEffects": false` |
| Tested against | React 19 / Next 16 |

## The config

One object per site, keyed by the CMS locale code. `@prismetic/seo-utils/localized`
reads the same object, so neither package depends on the other.

```js
const LOCALES = {
  defaultLocale: "en",
  locales: {
    en:      { prefix: "",   ogLocale: "en_US", hreflang: ["en"],          htmlLang: "en",    label: "EN" },
    "zh-CN": { prefix: "cn", ogLocale: "zh_CN", hreflang: ["zh-CN", "zh"], htmlLang: "zh-CN", label: "中文", enabled: ZH_ENABLED },
  },
};
```

| field | type | |
| --- | --- | --- |
| key | `string` | the CMS locale code, case-sensitive: Strapi rejects `zh-cn` |
| `prefix` | `string` | the URL segment; `""` for none. At most one locale may be unprefixed, and a default locale may carry a prefix |
| `ogLocale` | `string` | Open Graph locale, read by seo-utils |
| `hreflang` | `readonly string[]` | the codes this locale is advertised under, in order |
| `enabled` | `boolean` | default `true`. The site computes it — this package reads no env var |
| `htmlLang` | `string` | `<html lang>`; defaults to the key |
| `label` | `string` | the switcher's text |

`defaultLocale` is typed as `string`, so the locale union is inferred from the keys of
`locales` whether the object is a literal, `as const`, a plain JS object or annotated. A
`defaultLocale` that is not one of those keys is caught at runtime by `defineLocales`,
not by the type.

## Quick start

```ts
import { defineLocales } from "@prismetic/i18n-utils";

export const locales = defineLocales(LOCALES);

locales.localizePath("/articles/x/", "zh-CN");   // "/cn/articles/x/"
locales.localeFromPath("/cn/about/");            // "zh-CN"
locales.withLocale({ slug: "x" }, "zh-CN");      // { slug: "x", locale: "zh-CN" }
locales.withLocale({ slug: "x" }, "en");         // the same object, untouched
```

### Real-world usage

Mosbuild's shape: English unprefixed, Chinese under `/cn/` behind a go-live flag.

```js
// lib/i18n/locales.js — plain JS, so lib/siteConfig.js can require() it too
const ZH_LIVE = false;
const ZH_ENABLED =
  ZH_LIVE || process.env.NEXT_PUBLIC_APP_ENV === "preview" || process.env.NODE_ENV === "development";

module.exports = {
  LOCALES: {
    defaultLocale: "en",
    locales: {
      en:      { prefix: "",   ogLocale: "en_US", hreflang: ["en"],          htmlLang: "en",    label: "EN" },
      "zh-CN": { prefix: "cn", ogLocale: "zh_CN", hreflang: ["zh-CN", "zh"], htmlLang: "zh-CN", label: "中文", enabled: ZH_ENABLED },
    },
  },
};
```

```ts
// lib/i18n/config.ts
import { defineLocales } from "@prismetic/i18n-utils";
import { LOCALES } from "./locales.js";

export { LOCALES };
export const locales = defineLocales(LOCALES);
export type Locale = ReturnType<typeof locales.enabledLocales>[number];   // "en" | "zh-CN"
```

```ts
// lib/i18n/getDictionary.ts
import { defineDictionaries, type DictionaryShape } from "@prismetic/i18n-utils";

const en = { nav: { menu: "Menu" }, showing: (n: number, t: number) => `Showing ${n} of ${t}` };
const zhCN = {
  nav: { menu: "菜单" },
  showing: (n: number, t: number) => `已显示 ${n} / ${t}`,
} satisfies DictionaryShape<typeof en>;

export const getDictionary = defineDictionaries({ en, "zh-CN": zhCN });
```

```tsx
// components/LocaleProvider.tsx
"use client";
import { PathLocaleProvider, useLocale as usePackageLocale } from "@prismetic/i18n-utils/react";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { LOCALES } from "@/lib/i18n/locales";

export { LocaleProvider } from "@prismetic/i18n-utils/react";
export const useLocale = (): Locale => usePackageLocale<Locale>() || "en";
export const useDictionary = () => getDictionary(useLocale());

// Imports LOCALES itself, so the config ships in the JS chunk and not in the HTML.
export const NotFoundLocaleProvider = ({ children }: { children: ReactNode }) => (
  <PathLocaleProvider config={LOCALES}>{children}</PathLocaleProvider>
);
```

```tsx
// app/(zh)/layout.tsx — each root layout provides its locale
<html lang={locales.htmlLangOf("zh-CN")}>
  <body>
    <LocaleProvider locale="zh-CN">{children}</LocaleProvider>
  </body>
</html>

// app/global-not-found.tsx — one static 404.html serves every locale
<NotFoundLocaleProvider>{/* … */}</NotFoundLocaleProvider>
```

A config passed as a prop from a server component, as in `<PathLocaleProvider config={LOCALES}>`
inside `global-not-found.tsx`, is inlined into the page's HTML, disabled locales included.
Imported inside a client component, it ships in the JS chunk only.

```tsx
// components/LocaleSwitch.tsx — markup and styling stay in the site
"use client";
import { localizePath } from "@prismetic/i18n-utils";
import { useLocaleSwitch } from "@prismetic/i18n-utils/react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import { LOCALES } from "@/lib/i18n/locales";

const LocaleSwitch = ({ target }: { target: Locale }) => {
  const { linkProps } = useLocaleSwitch({
    hreflang: target,
    fallback: localizePath(LOCALES, "/", target),
    pathname: usePathname(),
  });
  return <a {...linkProps} className="…">{LOCALES.locales[target].label}</a>;
};
```

Client components import the plain `LOCALES` and use the standalone functions; only
server and Node code imports `lib/i18n/config`, which calls `defineLocales`.

```ts
// utils/api — English requests stay byte-identical
import { withLocale } from "@prismetic/i18n-utils";
import { LOCALES } from "@/lib/i18n/locales";

fetchGraphQL(ARTICLE_QUERY, withLocale(LOCALES, { slug }, locale));
```

---

## API reference

### Entry `.`

Every standalone function takes the plain config first. That config is plain data, so a
client component can import it and call these functions directly; `defineLocales` is the
bound convenience for server and Node code.

#### `defineLocales(config)`

```ts
defineLocales<L extends string>(config: LocalesConfig<L>): DefinedLocales<L>
```

Validates the config and returns it with every function below bound to it. The result
is still a `LocalesConfig<L>`, so server and Node code can pass it wherever a config is
expected.

**Never pass the `defineLocales` result to a client component.** The result carries
functions, and Next refuses to pass functions from a server component to a client
component. A client component imports the plain config object (`LOCALES`) itself: passed
as a prop from a server component, a config is inlined into the HTML; imported inside a
client component, it ships in the JS chunk only.

`"sideEffects": false` does not remove `validate()` from a client bundle when a module
imported by client code calls `defineLocales`. To keep it out, call `defineLocales` in
server or Node code and use the standalone functions with the plain config in client code.

**Throws** on `defaultLocale` not in `locales`, a `prefix` that is not a string, two
locales sharing a prefix, more than one unprefixed locale, a prefix containing `/`, an
`hreflang` that is not an array of strings, an empty `hreflang` or a blank code in it, one
hreflang code on two locales (compared case-insensitively), or an `ogLocale` that is not
a non-blank string. The same checks as `createLocalizedSeo` in seo-utils.

#### `localizePath(config, path, locale)`

For links the code builds — card paths, the logo, the 404 home link. A link typed into
the CMS renders as typed; editors write `/cn/…` themselves.

| `path` | unprefixed locale | `zh-CN` (`prefix: "cn"`) |
| --- | --- | --- |
| `"/"`, `""` | unchanged | `"/cn/"` |
| `"/articles/x/"` | unchanged | `"/cn/articles/x/"` |
| `"about"` | unchanged | `"/cn/about"` |
| `"/cn/about/"`, `"/cn"` | unchanged | unchanged — already prefixed, so calling it twice is safe |
| `"https://…"`, `"mailto:…"`, `"tel:…"`, `"//…"`, `"#…"`, `"?…"` | unchanged | unchanged |

A disabled locale is still prefixed. An unconfigured locale returns the path unchanged.

#### `localeFromPath(config, pathname)`

The locale a URL belongs to: an enabled prefixed locale whose prefix equals the first
segment exactly (`/cnc-machines/` is not `/cn/`), else the enabled unprefixed locale,
else `defaultLocale`. A disabled locale is never returned.

#### `stripLocalePrefix(config, segments, locale)`

Drops one leading segment equal to the locale's prefix, so a catch-all route accepts
`["cn", "about"]` and `["about"]` alike. Returns the same array when there is nothing to
drop.

#### `enabledLocales(config)` / `otherLocales(config, locale)` / `isLocaleEnabled(config, locale)`

Enabled locales in config order; the same without `locale`; whether one is enabled. An
unconfigured locale is not enabled.

#### `htmlLangOf(config, locale)`

`htmlLang`, falling back to the key.

#### `withLocale(config, variables, locale?)`

Adds `locale` to CMS query variables. The default locale, or no locale, returns
`variables` itself, so English requests stay byte-identical.

#### `defineDictionaries(dictionaries)` and `DictionaryShape<T>`

```ts
defineDictionaries<L extends string, D>(dictionaries: Record<L, D>): (locale: L) => D
type DictionaryShape<T>   // T with every string literal widened to string, deep
```

`zh satisfies DictionaryShape<typeof en>` makes a translation keep the English keys,
array shapes and function signatures while its strings differ. A missing key, an extra
key or a non-string value is a type error.

`DictionaryShape` widens every string literal to `string`, so a union such as
`"newest" | "oldest" | "title"` becomes `string`. It is for translatable text. Values that
are not translated, such as ids and enum-like values, belong outside the dictionary or need
their own type.

#### Types

```ts
interface LocaleDefinition {
  prefix: string;
  ogLocale: string;
  hreflang: readonly string[];
  enabled?: boolean;
  htmlLang?: string;
  label?: string;
}

interface LocalesConfig<L extends string = string> {
  defaultLocale: string;
  locales: Record<L, LocaleDefinition>;
}
```

Also exported: `DefinedLocales<L>`.

### Entry `./react`

#### `LocaleProvider` / `useLocale()`

```ts
LocaleProvider(props: { locale: string; children: ReactNode }): ReactElement
useLocale<L extends string = string>(): L
```

**`useLocale` never throws.** Outside a provider it returns `""`; map that to your default
locale in the site's own wrapper, as in the example above.

#### `PathLocaleProvider`

```ts
PathLocaleProvider(props: { config: LocalesConfig; children: ReactNode }): ReactElement
```

For the single static `404.html` that serves every unknown URL, where the locale is only
known in the browser. It provides `defaultLocale` until mount, then reads
`window.location.pathname` with `localeFromPath`, sets `<html lang>` with `htmlLangOf`
and provides that locale.

Render it from a client component in the site that imports `LOCALES` itself, as
`NotFoundLocaleProvider` does in the example above. A config passed as a prop from a
server component is inlined into the HTML; imported inside a client component, it ships in
the JS chunk only. Never pass the `defineLocales` result as `config`: it carries functions,
and Next refuses to pass functions from a server component to a client component.

#### `useLocaleSwitch(options)`

```ts
useLocaleSwitch(options: { hreflang: string; fallback: string; pathname?: string | null; lang?: string }): {
  href: string;
  linkProps: { href; hrefLang; lang; onPointerDown; onFocus; onClick };
}
```

`linkProps.hrefLang` is always `hreflang`. `linkProps.lang`, the language of the link's
text, is `lang` when given and `hreflang` otherwise, as in 0.1; pass `lang` when they
differ, for example `htmlLangOf(LOCALES, target)`.

Points the switcher at the same document in the other locale by reading the page's own
`<link rel="alternate" hreflang="…">`, which already carries the pairing — no site-wide
path map. It returns that link's **pathname**, so a preview host stays on its own
origin, or `fallback` when the page has no such link.

It reads the head in an effect keyed on `hreflang`, `fallback` and `pathname`. Client
navigation swaps the head after that effect has run, so it reads again on pointerdown,
focus and click and writes the result to `event.currentTarget.href` before the browser
follows the link — spread `linkProps` onto a plain `<a>`, not `next/link`. Pass
`usePathname()` as `pathname`; the package never imports `next/navigation`. The
markup and styling stay in the site.

Also exported: `LocaleSwitch`, `LocaleSwitchOptions`, `LocaleSwitchLinkProps`.

---

## Limits

- **`localizePath` is for code-built links only.** It does not rewrite CMS links, markdown
  or rich text.
- **`useLocaleSwitch` needs the page to render its hreflang links.** A page with none,
  including every page while a locale is disabled, gets `fallback`.
- **`PathLocaleProvider` renders the default locale first.** The 404 page's text switches
  after hydration.
- **Client components import the plain `LOCALES` object themselves.** Passed as a prop
  from a server component, a config is inlined into the HTML; imported inside a client
  component, it ships in the JS chunk only. Never pass the `defineLocales` result: it
  carries functions, which Next will not pass from a server component to a client
  component.

## Upgrading to 0.2

No code change is needed, and nothing changes unless a site passes the new `lang` option
to `useLocaleSwitch`. `package.json` now declares `"sideEffects": false`. The README now
renders `PathLocaleProvider` from a client component that imports `LOCALES` itself, which
keeps the config out of the HTML.

## Development

```bash
npm test -w i18n-utils        # vitest — 113 tests across 3 files, type tests included
npm run build -w i18n-utils
```

`dictionary.test-d.ts` is checked by `tsc` through `tsconfig.typecheck.json`; an unused
`@ts-expect-error` fails the run. `react.test.ts` runs in happy-dom. The invalid and valid
locale configs in `test-fixtures/localeConfigCases.ts`, at the repo root, run in this
package and in seo-utils, so the two `validate()` copies cannot drift.
