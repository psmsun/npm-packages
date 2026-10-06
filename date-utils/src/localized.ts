import { dateFormat, isCalendarDate, timeFormat, toDate, toTime } from "./date.js";

// The token formatter only knows English names, so the language picks the path, not the site's default locale.
const isEnglish = (locale: string) => /^en(?:-|$)/i.test(locale);

export const formatLocalizedDate = (
  value: string | null | undefined,
  locale: string,
  enFormat: string,
  options: Intl.DateTimeFormatOptions,
) => {
  if (isEnglish(locale)) return dateFormat(value, enFormat);
  if (!value) return "";
  const calendar = isCalendarDate(value);
  const date = toDate(value, calendar);
  if (!date) return "";
  return new Intl.DateTimeFormat(locale, calendar ? { ...options, timeZone: "UTC" } : options).format(date);
};

export const formatLocalizedTime = (
  value: string | null | undefined,
  locale: string,
  enFormat: string,
  options: Intl.DateTimeFormatOptions,
) => {
  if (isEnglish(locale)) return timeFormat(value, enFormat);
  const time = toTime(value);
  if (!time) return "";
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    Date.UTC(2000, 0, 1, time.hour, time.minute),
  );
};
