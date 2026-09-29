import { describe, expectTypeOf, it } from "vitest";
import {
  type DictionaryShape,
  defineDictionaries,
  defineLocales,
  localeFromPath,
  type LocalesConfig,
  localizePath,
} from "./index.js";

const en = {
  nav: { menu: "Menu", mainMenu: "Main menu" },
  showing: (shown: number, total: number) => `Showing ${shown} of ${total}`,
  months: ["Jan", "Feb"],
} as const;

describe("DictionaryShape", () => {
  it("accepts a zh dictionary with different strings", () => {
    const zh = {
      nav: { menu: "菜单", mainMenu: "主菜单" },
      showing: (shown: number, total: number) => `已显示 ${shown} / ${total}`,
      months: ["一月", "二月"],
    } as const satisfies DictionaryShape<typeof en>;
    expectTypeOf(zh).toExtend<DictionaryShape<typeof en>>();
    expectTypeOf(en).toExtend<DictionaryShape<typeof en>>();
  });

  it("widens every string literal, deep", () => {
    expectTypeOf<DictionaryShape<typeof en>["nav"]["menu"]>().toEqualTypeOf<string>();
    expectTypeOf<DictionaryShape<typeof en>["months"]>().toEqualTypeOf<readonly [string, string]>();
    expectTypeOf<ReturnType<DictionaryShape<typeof en>["showing"]>>().toEqualTypeOf<string>();
    expectTypeOf<Parameters<DictionaryShape<typeof en>["showing"]>>().toEqualTypeOf<[shown: number, total: number]>();
  });

  it("rejects a missing key", () => {
    // @ts-expect-error mainMenu is missing
    const zh = { nav: { menu: "菜单" }, showing: () => "", months: ["一月", "二月"] } as const satisfies DictionaryShape<typeof en>;
    expectTypeOf(zh.nav.menu).toEqualTypeOf<"菜单">();
  });

  it("rejects an extra key", () => {
    // @ts-expect-error extra is not in the en shape
    const zh = { nav: { menu: "菜单", mainMenu: "主菜单", extra: "多余" }, showing: () => "", months: ["一月", "二月"] } as const satisfies DictionaryShape<typeof en>;
    expectTypeOf(zh.nav.menu).toEqualTypeOf<"菜单">();
  });

  it("rejects a value that is not a string", () => {
    // @ts-expect-error menu must be a string
    const zh = { nav: { menu: 1, mainMenu: "主菜单" }, showing: () => "", months: ["一月", "二月"] } as const satisfies DictionaryShape<typeof en>;
    expectTypeOf(zh.nav.mainMenu).toEqualTypeOf<"主菜单">();
  });
});

describe("inference", () => {
  it("keys defineDictionaries by locale", () => {
    const getDictionary = defineDictionaries({ en, "zh-CN": en });
    expectTypeOf(getDictionary).parameter(0).toEqualTypeOf<"en" | "zh-CN">();
  });

  const enLocale = { prefix: "", ogLocale: "en_US", hreflang: ["en"] };
  const zhLocale = { prefix: "cn", ogLocale: "zh_CN", hreflang: ["zh-CN", "zh"] };
  const plain = { defaultLocale: "en", locales: { en: enLocale, "zh-CN": zhLocale } };
  const asConst = {
    defaultLocale: "en",
    locales: {
      en: { prefix: "", ogLocale: "en_US", hreflang: ["en"] },
      "zh-CN": { prefix: "cn", ogLocale: "zh_CN", hreflang: ["zh-CN", "zh"] },
    },
  } as const;
  const annotated: LocalesConfig<"en" | "zh-CN"> = plain;

  it("infers the locale union from an inline literal", () => {
    const locales = defineLocales({ defaultLocale: "en", locales: { en: enLocale, "zh-CN": zhLocale } });
    expectTypeOf(locales.localeFromPath("/")).toEqualTypeOf<"en" | "zh-CN">();
    expectTypeOf(locales.enabledLocales()).toEqualTypeOf<("en" | "zh-CN")[]>();
    expectTypeOf(localeFromPath({ defaultLocale: "en", locales: { en: enLocale, "zh-CN": zhLocale } }, "/")).toEqualTypeOf<
      "en" | "zh-CN"
    >();
  });

  it("infers the locale union from an as const config", () => {
    expectTypeOf(defineLocales(asConst).localeFromPath("/")).toEqualTypeOf<"en" | "zh-CN">();
    expectTypeOf(localeFromPath(asConst, "/")).toEqualTypeOf<"en" | "zh-CN">();
  });

  it("infers the locale union from a plain object", () => {
    expectTypeOf(defineLocales(plain).localeFromPath("/")).toEqualTypeOf<"en" | "zh-CN">();
    expectTypeOf(localeFromPath(plain, "/")).toEqualTypeOf<"en" | "zh-CN">();
  });

  it("infers the locale union from an annotated config", () => {
    expectTypeOf(defineLocales(annotated).localeFromPath("/")).toEqualTypeOf<"en" | "zh-CN">();
    expectTypeOf(localeFromPath(annotated, "/")).toEqualTypeOf<"en" | "zh-CN">();
  });

  it("types a locale argument against the keys", () => {
    // @ts-expect-error "zh-cn" is not a configured locale
    localizePath(plain, "/", "zh-cn");
    expectTypeOf(localizePath(plain, "/", "zh-CN")).toEqualTypeOf<string>();
  });
});
