/**
 * The four Red Sea sites expressed as `./bilingual` config — the per-site constants lifted verbatim
 * out of each repo's `lib/seo.(js|ts)` at the commit the goldens were captured from.
 *
 * `siteName` is only ever the last-resort title, and on these sites `defaults[locale].title`
 * always answers first, so it is set to the English default for completeness.
 */

import type { BilingualSeoConfig } from "../../bilingual.js";

export type RedSeaRepo = "turtlebay" | "daraah" | "desertrock" | "shebara";

const COMMON = {
  locales: {
    all: ["en", "ar"] as const,
    default: "en",
    ogLocale: { en: "en_US", ar: "ar_SA" },
  },
  inherit: ["metaTitle", "metaDescription", "metaImage"] as const,
  hiddenBuildEnv: [
    { name: "NODE_ENV", equals: "development" },
    { name: "VERCEL_ENV", equals: "preview" },
    { name: "NEXT_PUBLIC_ROBOTS_NOINDEX", equals: "1" },
  ],
} satisfies Partial<BilingualSeoConfig>;

export const RED_SEA_SITES: Record<RedSeaRepo, BilingualSeoConfig> = {
  turtlebay: {
    ...COMMON,
    siteUrl: "https://turtlebayhotel.sa",
    siteName: "TURTLE BAY RESORT",
    defaults: {
      en: {
        title: "TURTLE BAY RESORT",
        description:
          "Turtle Bay Resort is a Red Sea holiday playground where adventure, relaxation and a sense of community go hand in hand.",
      },
      ar: {
        title: "فندق تيرتل باي",
        description:
          "تدعوك شواطئ البحر الأحمر لاكتشاف الصفاء والجمال في منتجع تيرتل باي، أحد أبرز منتجعات البحر الأحمر. مياه صافية، شواطئ هادئة، وأجواء تساعدك على الاسترخاء.",
      },
    },
  },
  daraah: {
    ...COMMON,
    siteUrl: "https://daraah.sa",
    siteName: "DARAAH RESORT",
    defaults: {
      en: {
        title: "DARAAH RESORT",
        description:
          "Daraah Resort offers serenity and a spectacular setting on the shimmering Red Sea, a wellness retreat on the Al Wajh coast made for rest and recovery.",
      },
      ar: {
        title: "فندق دارة",
        description:
          "تدعوك شواطئ البحر الأحمر لاكتشاف الصفاء والجمال في منتجع دارة، أحد أبرز منتجعات البحر الأحمر. مياه صافية، شواطئ هادئة، وأجواء تساعدك على الاسترخاء.",
      },
    },
  },
  desertrock: {
    ...COMMON,
    siteUrl: "https://www.desertrock.sa",
    siteName: "DESERT ROCK",
    // This site's default description IS its default title. Any comparison that tokenises
    // these strings has to key on the field, not on the value.
    defaults: {
      en: { title: "DESERT ROCK", description: "DESERT ROCK" },
      ar: { title: "ديزرت روك", description: "ديزرت روك" },
    },
  },
  shebara: {
    ...COMMON,
    siteUrl: "https://www.shebara.sa",
    siteName: "Shebara",
    defaults: {
      en: {
        title: "Shebara",
        description:
          "Discover Shebara — a Red Sea island destination where refined hospitality meets pristine nature.",
      },
      ar: {
        title: "شيبارا",
        description:
          "اكتشف شيبارا — وجهة جزيرة في البحر الأحمر حيث تلتقي الضيافة الراقية بالطبيعة البكر.",
      },
    },
  },
};
