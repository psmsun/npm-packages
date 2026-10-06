import { compileDate, compileTime, type DateFields } from "./format.js";

export type DateFormatOptions = {
  /** Read the value in UTC, like `moment.utc(value)`. */
  utc?: boolean;
};

const ISO =
  /^(\d{4})(?:-(\d\d)(?:-(\d\d)(?:[T ](\d\d)(?::(\d\d)(?::(\d\d)(?:[.,](\d+))?)?)?(Z|([+-])(\d\d)(?::?(\d\d))?)?)?)?)?$/;
const CALENDAR_DATE = /^\d{4}(?:-\d\d(?:-\d\d)?)?$/;
const TIME = /^(\d{1,2}):(\d\d)/;

const daysInMonth = (year: number, month: number) =>
  month === 2
    ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
      ? 29
      : 28
    : 31 - (((month - 1) % 7) % 2);

export const isCalendarDate = (value: string) => CALENDAR_DATE.test(value);

export const toDate = (value: string, utc: boolean): Date | undefined => {
  const match = ISO.exec(value);
  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const year = Number(match[1]);
  const month = Number(match[2] ?? 1);
  const day = Number(match[3] ?? 1);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const second = Number(match[6] ?? 0);
  const ms = match[7] ? Math.floor(Number(`0.${match[7]}`) * 1000) : 0;
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 24 ||
    minute > 59 ||
    second > 59 ||
    (hour === 24 && (minute || second || ms))
  ) {
    return undefined;
  }
  const zone = match[8];
  if (!zone && !utc) {
    // Noon base: no zone changes clocks at noon, so setFullYear can never land in a gap.
    const date = new Date(2000, 0, 1, 12);
    date.setFullYear(year, month - 1, day);
    date.setHours(hour, minute, second, ms);
    return date;
  }
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, ms);
  if (zone && zone !== "Z") {
    const offset = Number(match[10]) * 60 + Number(match[11] ?? 0);
    date.setTime(date.getTime() - (match[9] === "-" ? -offset : offset) * 60_000);
  }
  return date;
};

export const toTime = (value: string | null | undefined) => {
  const match = TIME.exec(value ?? "");
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return undefined;
  return { hour: Number(match[1]), minute: Number(match[2]) };
};

const fieldsOf = (date: Date, utc: boolean): DateFields =>
  utc
    ? {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth(),
        day: date.getUTCDate(),
        weekday: date.getUTCDay(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
      }
    : {
        year: date.getFullYear(),
        month: date.getMonth(),
        day: date.getDate(),
        weekday: date.getDay(),
        hour: date.getHours(),
        minute: date.getMinutes(),
        second: date.getSeconds(),
      };

export const dateFormat = (
  value: string | null | undefined,
  pattern: string,
  { utc = false }: DateFormatOptions = {},
) => {
  const render = compileDate(pattern);
  const date = value ? toDate(value, utc) : undefined;
  return date ? render(fieldsOf(date, utc)) : "";
};

export const timeFormat = (value: string | null | undefined, pattern: string) => {
  const render = compileTime(pattern);
  const time = toTime(value);
  return time ? render({ ...time, second: 0 }) : "";
};

const order = (a: number, b: number) =>
  Number.isNaN(a) ? (Number.isNaN(b) ? 0 : 1) : Number.isNaN(b) ? -1 : a - b;

const instant = (value: string | null | undefined) =>
  (value ? toDate(value, false)?.getTime() : undefined) ?? Number.NaN;

const minutes = (value: string | null | undefined) => {
  const time = toTime(value);
  return time ? time.hour * 60 + time.minute : Number.NaN;
};

export const compareDates = (a: string | null | undefined, b: string | null | undefined) =>
  order(instant(a), instant(b));

export const compareTimes = (a: string | null | undefined, b: string | null | undefined) =>
  order(minutes(a), minutes(b));
