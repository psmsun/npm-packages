import moment from "moment";

moment.suppressDeprecationWarnings = true;

export { moment };

// Fleet zones plus the awkward ones: half-hour offsets, the date line, DST at midnight (Sao Paulo until 2019).
export const ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/St_Johns",
  "America/Sao_Paulo",
  "Europe/Moscow",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Pacific/Kiritimati",
];

export const inZone = <T>(zone: string, run: () => T): T => {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
};

export const FLEET_PATTERNS = [
  "DD.MM.YYYY",
  "MM.DD.YYYY",
  "MMM Do, YYYY",
  "MMM D",
  "DD MMM YYYY",
  "MMM D,YYYY",
  "dddd ,D MMM",
  "MMMM DD,YYYY",
  "MMM DD, YYYY",
  "dddd, MMM DD, YYYY",
  "DD",
  "MMMM",
  "LTS",
  "hh:mm A",
  "HH:mm",
];

export const TIME_TOKENS = ["H", "HH", "h", "hh", "m", "mm", "s", "ss", "A", "a", "LT", "LTS"];

export const DATE_TOKENS = [
  ...TIME_TOKENS,
  "YYYY",
  "YY",
  "M",
  "Mo",
  "MM",
  "MMM",
  "MMMM",
  "D",
  "Do",
  "DD",
  "d",
  "dd",
  "ddd",
  "dddd",
  "L",
  "LL",
  "LLL",
  "LLLL",
  "l",
  "ll",
  "lll",
  "llll",
];

export const EVERY_TIME_TOKEN = TIME_TOKENS.join("|");
export const EVERY_DATE_TOKEN = DATE_TOKENS.join("|");
