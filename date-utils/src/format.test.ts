import { describe, expect, it } from "vitest";
import { DATE_TOKENS, EVERY_DATE_TOKEN, EVERY_TIME_TOKEN, FLEET_PATTERNS, moment, TIME_TOKENS } from "./__fixtures__/moment.js";
import { dateFormat, timeFormat } from "./index.js";

// Every day of a leap year at a different time: all months, days, weekdays, hours, minutes and seconds appear.
const LEAP_YEAR = Array.from({ length: 366 }, (_, i) =>
  new Date(Date.UTC(2024, 0, 1 + i, i % 24, (i * 7) % 60, (i * 13) % 60)).toISOString(),
);

const mismatches = (inputs: string[], patterns: string[]) =>
  inputs.flatMap((input) =>
    patterns.flatMap((pattern) => {
      const want = moment.utc(input).format(pattern);
      const got = dateFormat(input, pattern, { utc: true });
      return want === got ? [] : [{ input, pattern, want, got }];
    }),
  );

describe("tokens", () => {
  it("renders every supported token like moment on every day of a leap year", () => {
    expect(mismatches(LEAP_YEAR, [EVERY_DATE_TOKEN])).toEqual([]);
  });

  it("renders the fleet's patterns like moment", () => {
    expect(mismatches(LEAP_YEAR, FLEET_PATTERNS)).toEqual([]);
  });

  it("matches moment on literals, escapes and token boundaries", () => {
    const patterns = [
      "[Today is] dddd",
      "YYYY-MM-DD[T]HH:mm:ss",
      "[[]YYYY[]]",
      "[ YYYY",
      "YYYY ]",
      "\\D\\o D",
      "\\\\YYYY",
      "YYYY\\",
      "Do\nYYYY",
      "MMMMM",
      "ddddd",
      "YYYYMMDD",
      "HHmmss",
      "D MMMM YYYY г.",
      "YYYY年M月D日",
      "LLLL [at] LT",
    ];
    expect(mismatches(LEAP_YEAR.slice(0, 40), patterns)).toEqual([]);
  });

  it("pads years below 1000 like moment", () => {
    expect(mismatches(["0050-01-01", "0999-12-31T23:59:59Z"], ["YYYY YY"])).toEqual([]);
  });

  it("matches moment for every pair of adjacent tokens, or refuses the ones that merge", () => {
    // moment reads these pairs as one token this package does not render, or leaves a bare "T".
    const refused = new Set([
      "Hmm", "hmm", "YYYYYY", "YYYYYYYY", "MMo", "MMMo", "MMMMo", "DDo", "DDD", "DDDo", "DDDD",
      "LLT", "LLTS", "LLLT", "LLLTS", "LLLLT", "LLLLTS", "LYY", "LYYYY", "LLYY", "LLYYYY", "lYY", "lYYYY", "llYY", "llYYYY",
    ]);
    const inputs = ["2024-01-05T09:04:03Z", "2025-11-22T13:45:30Z"];
    const failures = [];
    for (const a of DATE_TOKENS) {
      for (const b of DATE_TOKENS) {
        const pattern = a + b;
        if (refused.has(pattern)) expect(() => dateFormat(inputs[0], pattern)).toThrow(RangeError);
        else failures.push(...mismatches(inputs, [pattern]));
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("unsupported tokens", () => {
  it.each([
    "Q", "Qo", "w", "wo", "ww", "W", "WW", "Y", "YYYYY", "YYYYYY", "y", "yyyy", "gggg", "GGGG",
    "e", "E", "do", "DDD", "DDDD", "DDDo", "k", "kk", "Hmm", "hmm", "Hmmss", "S", "SSS", "x", "X",
    "z", "Z", "ZZ", "N", "T", "YYYY-MM-DDTHH:mm",
  ])("throws on %j instead of rendering something moment wouldn't", (pattern) => {
    expect(() => dateFormat("2024-03-10", pattern)).toThrow(RangeError);
  });

  it("throws on a bad pattern even when the value is empty", () => {
    expect(() => dateFormat(null, "Q")).toThrow(/"Q" is not a supported date token in "Q"/);
    expect(() => timeFormat(undefined, "Q")).toThrow(/"Q" is not a supported time token/);
  });

  it("only takes time tokens in timeFormat", () => {
    for (const token of TIME_TOKENS) expect(() => timeFormat("09:30", token)).not.toThrow();
    for (const token of ["YYYY", "D", "Do", "MMM", "dddd", "L", "LL", "ll"]) {
      expect(() => timeFormat("09:30", token)).toThrow(RangeError);
    }
    expect(timeFormat("13:05", EVERY_TIME_TOKEN)).toBe(moment.utc("13:05", "HH:mm").format(EVERY_TIME_TOKEN));
  });
});
