import { describe, expect, it } from "vitest";
import { EVERY_DATE_TOKEN, EVERY_TIME_TOKEN, inZone, moment, ZONES } from "./__fixtures__/moment.js";
import { compareDates, compareTimes, dateFormat, timeFormat } from "./index.js";

const ISO_INPUTS = [
  "2024-01-01",
  "2024-02-29",
  "2024-03-10",
  "2024-11-03",
  "2018-11-04",
  "2024-12-31",
  "2024",
  "2024-03",
  "2024-03-10T02:30:00",
  "2024-11-03T01:30:00",
  "2018-11-04T00:30",
  "2024-12-31T23:59:59",
  "2024-01-01T00:00:00.000",
  "2024-06-15T12:00",
  "2024-06-15T12",
  "2024-06-15 08:05:09",
  "2024-06-15T08:05:09,5",
  "2024-06-15T24:00:00",
  "2024-12-31T23:30:00.000Z",
  "2025-01-01T00:30:00Z",
  "2024-02-29T12:00:00.000Z",
  "2024-03-10T10:00:00.000Z",
  "2024-06-15T23:59:59.999999Z",
  "2024-06-15T24:00:00Z",
  "2024-06-15T00:30:00+03:00",
  "2024-06-15T23:30:00-0800",
  "2024-06-15T12:00:00+05",
  "2024-06-15T10:00:00+14:00",
  "2024-06-15T10:00:00-03:30",
];

// Every 3 days 7 hours 13 minutes for three years, as a date, a UTC instant and an offset-free local time.
const SWEEP = Array.from({ length: 333 }, (_, i) => {
  const iso = new Date(Date.UTC(2024, 0, 1) + i * ((3 * 24 + 7) * 60 + 13) * 60_000).toISOString();
  return [iso.slice(0, 10), iso, iso.slice(0, 19)];
}).flat();

const ZONED_ENGINE_INPUTS = ["Sun, 10 Mar 2024 10:00:00 GMT", "Sun, 10 Mar 2024 10:00:00 +0300"];
const LOCAL_ENGINE_INPUTS = ["March 10, 2024", "10 March 2024 10:00", "2024-03T10:00"];

const INVALID = [
  "nope",
  "2024-02-30",
  "2023-02-29",
  "2024-13-01",
  "2024-00-10",
  "2024-06-00",
  "2024-06-31",
  "2024-06-15T25:00",
  "2024-06-15T24:30",
  "2024-06-15T12:60",
  "2024-06-15T12:00:60",
];

const MIXED = [
  "2025-10-14",
  "2025-10-13T23:30:00",
  "2025-10-14T00:30:00",
  "2025-10-13T22:00:00Z",
  "2025-10-14T01:00:00+03:00",
  "2025-10-15",
  "2024-12-31",
  "2025-01-01T00:00:00+14:00",
  "2025-03",
  "2025",
  "2025-03-30T02:30:00",
];

const MINUTES_OF_DAY = Array.from(
  { length: 1440 },
  (_, i) => `${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}`,
);

const mismatches = (inputs: string[], utcModes: boolean[]) =>
  inputs.flatMap((input) =>
    utcModes.flatMap((utc) => {
      const want = (utc ? moment.utc(input) : moment(input)).format(EVERY_DATE_TOKEN);
      const got = dateFormat(input, EVERY_DATE_TOKEN, { utc });
      return want === got ? [] : [{ input, utc, want, got }];
    }),
  );

it("switches the process time zone, which every zone test relies on", () => {
  expect(inZone("Asia/Tokyo", () => new Date(0).getTimezoneOffset())).toBe(-540);
  expect(inZone("America/St_Johns", () => new Date(0).getTimezoneOffset())).toBe(210);
});

describe.each(ZONES)("dateFormat, TZ=%s", (zone) => {
  it("reads values like moment and moment.utc", () => {
    inZone(zone, () => {
      expect(mismatches([...ISO_INPUTS, ...SWEEP, ...ZONED_ENGINE_INPUTS], [false, true])).toEqual([]);
      expect(mismatches(LOCAL_ENGINE_INPUTS, [false])).toEqual([]);
    });
  });

  it("returns '' exactly where moment is invalid", () => {
    inZone(zone, () => {
      for (const input of INVALID) {
        expect(moment(input).isValid()).toBe(false);
        expect(dateFormat(input, "DD.MM.YYYY")).toBe("");
        expect(dateFormat(input, "DD.MM.YYYY", { utc: true })).toBe("");
      }
    });
  });

  it("compares like moment's diff", () => {
    inZone(zone, () => {
      const wrong = MIXED.flatMap((a) =>
        MIXED.flatMap((b) => {
          const want = moment(a).diff(moment(b));
          const got = compareDates(a, b);
          return want === got ? [] : [{ a, b, want, got }];
        }),
      );
      expect(wrong).toEqual([]);
    });
  });
});

describe("dateFormat", () => {
  it("returns '' for a missing value", () => {
    for (const value of [null, undefined, ""]) expect(dateFormat(value, "DD.MM.YYYY")).toBe("");
  });
});

describe("compareDates", () => {
  it("sorts missing and invalid values last, in their original order", () => {
    expect([null, "2025-10-15", "nope", "2025-10-13", undefined, "2025-02-30"].sort(compareDates)).toEqual([
      "2025-10-13",
      "2025-10-15",
      null,
      "nope",
      "2025-02-30",
      undefined,
    ]);
  });
});

describe("timeFormat", () => {
  it("formats every minute like moment(value, 'HH:mm'), with or without seconds", () => {
    inZone("UTC", () => {
      const wrong = MINUTES_OF_DAY.flatMap((hhmm) =>
        [hhmm, `${hhmm}:00`, `${hhmm}:45.500`, hhmm.replace(/^0/, "")].flatMap((value) => {
          const want = moment(value, "HH:mm").format(EVERY_TIME_TOKEN);
          const got = timeFormat(value, EVERY_TIME_TOKEN);
          return want === got ? [] : [{ value, want, got }];
        }),
      );
      expect(wrong).toEqual([]);
    });
  });

  it("returns '' for missing or out-of-range times", () => {
    for (const value of [null, undefined, "", "nope", "24:00", "12:60", "9", "1:5", "123:45"]) {
      expect(timeFormat(value, "HH:mm")).toBe("");
    }
  });
});

describe("compareTimes", () => {
  it("orders like moment(value, 'HH:mm')", () => {
    inZone("UTC", () => {
      const times = ["09:30:00.000", "9:05", "13:00", "00:00:00", "23:59", "12:00:00.000", "10:15", "09:30"];
      const wrong = times.flatMap((a) =>
        times.flatMap((b) => {
          const want = Math.sign(moment(a, "HH:mm").diff(moment(b, "HH:mm")));
          const got = Math.sign(compareTimes(a, b));
          return want === got ? [] : [{ a, b, want, got }];
        }),
      );
      expect(wrong).toEqual([]);
    });
  });

  it("sorts missing and invalid times last, in their original order", () => {
    expect(["13:00", null, "nope", "9:05", "25:00"].sort(compareTimes)).toEqual(["9:05", "13:00", null, "nope", "25:00"]);
  });
});
