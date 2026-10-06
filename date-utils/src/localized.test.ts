import { describe, expect, it, vi } from "vitest";
import { inZone, moment, ZONES } from "./__fixtures__/moment.js";
import { dateFormat, formatLocalizedDate, formatLocalizedTime, timeFormat } from "./index.js";

// Every 11 days 7 hours for three years, as a date and as a UTC instant.
const VALUES = Array.from({ length: 97 }, (_, i) => {
  const iso = new Date(Date.UTC(2024, 0, 1) + i * (11 * 24 + 7) * 3_600_000).toISOString();
  return [iso.slice(0, 10), iso];
}).flat();

const DATE_OPTIONS: Intl.DateTimeFormatOptions[] = [
  { dateStyle: "long" },
  { month: "short", day: "numeric" },
  { weekday: "long", year: "numeric", month: "long", day: "numeric" },
];

const TIME_OPTIONS: Intl.DateTimeFormatOptions[] = [
  { timeStyle: "medium" },
  { timeStyle: "short" },
  { hour: "numeric", minute: "2-digit" },
];

describe.each(["en", "en-US", "en-GB", "EN"])("%s", (locale) => {
  it("uses the moment tokens, not Intl", () => {
    for (const value of ["2025-10-14", "2025-10-14T21:30:00.000Z", null, "nope"]) {
      expect(formatLocalizedDate(value, locale, "MMM Do, YYYY", { dateStyle: "long" })).toBe(
        dateFormat(value, "MMM Do, YYYY"),
      );
    }
    for (const value of ["09:30:00.000", "18:05", null, "25:00"]) {
      expect(formatLocalizedTime(value, locale, "LTS", { timeStyle: "medium" })).toBe(timeFormat(value, "LTS"));
    }
  });
});

describe.each(ZONES)("other locales, TZ=%s", (zone) => {
  it("format dates like Intl over moment's Date", () => {
    inZone(zone, () => {
      const wrong = [];
      for (const locale of ["zh-CN", "ru"]) {
        for (const options of DATE_OPTIONS) {
          const intl = new Intl.DateTimeFormat(locale, options);
          for (const value of VALUES) {
            const want = intl.format(moment(value).toDate());
            const got = formatLocalizedDate(value, locale, "MMM D", options);
            if (want !== got) wrong.push({ locale, options, value, want, got });
          }
        }
      }
      expect(wrong).toEqual([]);
    });
  });

  it("keep a date-only value's day whatever timeZone the options carry", () => {
    inZone(zone, () => {
      for (const timeZone of ["Pacific/Honolulu", "Pacific/Kiritimati"]) {
        expect(formatLocalizedDate("2025-10-14", "zh-CN", "MMM D", { dateStyle: "long", timeZone })).toBe(
          "2025年10月14日",
        );
      }
    });
  });

  it("never shift a time, even on a DST-change day", () => {
    // Clocks skip 02:00-03:00 that night in Los Angeles and St. John's.
    vi.useFakeTimers({ now: new Date("2026-03-08T12:00:00Z"), toFake: ["Date"] });
    try {
      inZone(zone, () => {
        expect(formatLocalizedTime("02:30", "zh-CN", "LTS", { timeStyle: "medium" })).toBe("02:30:00");
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("formatLocalizedTime", () => {
  it("formats times like Intl over moment(value, 'HH:mm')", () => {
    inZone("UTC", () => {
      const wrong = [];
      for (const locale of ["zh-CN", "ru"]) {
        for (const options of TIME_OPTIONS) {
          const intl = new Intl.DateTimeFormat(locale, options);
          for (let minute = 0; minute < 1440; minute += 7) {
            const value = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00.000`;
            const want = intl.format(moment(value, "HH:mm").toDate());
            const got = formatLocalizedTime(value, locale, "LTS", options);
            if (want !== got) wrong.push({ locale, options, value, want, got });
          }
        }
      }
      expect(wrong).toEqual([]);
    });
  });
});

describe("both", () => {
  it("return '' and never throw on missing or invalid values", () => {
    for (const locale of ["en", "zh-CN"]) {
      for (const value of [null, undefined, "", "nope", "2024-02-30", "25:00"]) {
        expect(formatLocalizedDate(value, locale, "MMM D", { dateStyle: "long" })).toBe("");
        expect(formatLocalizedTime(value, locale, "LTS", { timeStyle: "medium" })).toBe("");
      }
    }
  });

  it("route by language, not by the site's default locale", () => {
    expect(formatLocalizedDate("2025-10-14", "ru", "MMM D", { month: "long", day: "numeric" })).toBe("14 октября");
  });
});
