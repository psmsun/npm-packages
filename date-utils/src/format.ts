export type TimeFields = { hour: number; minute: number; second: number };

export type DateFields = TimeFields & {
  year: number;
  month: number;
  day: number;
  weekday: number;
};

type Renderer<F> = (fields: F) => string;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const LONG_FORMATS: Record<string, string> = {
  LT: "h:mm A",
  LTS: "h:mm:ss A",
  L: "MM/DD/YYYY",
  LL: "MMMM D, YYYY",
  LLL: "MMMM D, YYYY h:mm A",
  LLLL: "dddd, MMMM D, YYYY h:mm A",
  l: "M/D/YYYY",
  ll: "MMM D, YYYY",
  lll: "MMM D, YYYY h:mm A",
  llll: "ddd, MMM D, YYYY h:mm A",
};

// moment 2.30.1's own tokenizer regexes, so every pattern splits exactly where moment splits it.
const LONG_TOKENS = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;
const TOKENS =
  /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|N{1,5}|YYYYYY|YYYYY|YYYY|YY|y{2,4}|yo?|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

const pad = (value: number, width = 2) =>
  `${value < 0 ? "-" : ""}${String(Math.abs(value)).padStart(width, "0")}`;

const ordinal = (value: number) => {
  const last = value % 10;
  const suffix =
    Math.floor((value % 100) / 10) === 1
      ? "th"
      : last === 1
        ? "st"
        : last === 2
          ? "nd"
          : last === 3
            ? "rd"
            : "th";
  return `${value}${suffix}`;
};

const hour12 = (hour: number) => hour % 12 || 12;

const TIME_TOKENS = new Map<string, Renderer<TimeFields>>([
  ["H", (f) => String(f.hour)],
  ["HH", (f) => pad(f.hour)],
  ["h", (f) => String(hour12(f.hour))],
  ["hh", (f) => pad(hour12(f.hour))],
  ["m", (f) => String(f.minute)],
  ["mm", (f) => pad(f.minute)],
  ["s", (f) => String(f.second)],
  ["ss", (f) => pad(f.second)],
  ["A", (f) => (f.hour < 12 ? "AM" : "PM")],
  ["a", (f) => (f.hour < 12 ? "am" : "pm")],
]);

const DATE_TOKENS = new Map<string, Renderer<DateFields>>([
  ...TIME_TOKENS,
  ["YYYY", (f) => pad(f.year, 4)],
  ["YY", (f) => pad(f.year % 100)],
  ["M", (f) => String(f.month + 1)],
  ["Mo", (f) => ordinal(f.month + 1)],
  ["MM", (f) => pad(f.month + 1)],
  ["MMM", (f) => MONTHS[f.month].slice(0, 3)],
  ["MMMM", (f) => MONTHS[f.month]],
  ["D", (f) => String(f.day)],
  ["Do", (f) => ordinal(f.day)],
  ["DD", (f) => pad(f.day)],
  ["d", (f) => String(f.weekday)],
  ["dd", (f) => WEEKDAYS[f.weekday].slice(0, 2)],
  ["ddd", (f) => WEEKDAYS[f.weekday].slice(0, 3)],
  ["dddd", (f) => WEEKDAYS[f.weekday]],
]);

const compile = <F>(pattern: string, tokens: Map<string, Renderer<F>>, kind: string) => {
  const parts = (pattern.replace(LONG_TOKENS, (match) => LONG_FORMATS[match] ?? match).match(TOKENS) ?? []).map(
    (token) => {
      const render = tokens.get(token);
      if (render) return render;
      if (token.length > 1 && token[0] === "[") return token.slice(1, -1);
      if (token[0] === "\\") return token.replace(/\\/g, "");
      if (/[A-Za-z]/.test(token)) {
        throw new RangeError(
          `@prismetic/date-utils: "${token}" is not a supported ${kind} token in "${pattern}". Put literal text in [brackets].`,
        );
      }
      return token;
    },
  );
  return (fields: F) => parts.map((part) => (typeof part === "string" ? part : part(fields))).join("");
};

export const compileDate = (pattern: string) => compile(pattern, DATE_TOKENS, "date");

export const compileTime = (pattern: string) => compile(pattern, TIME_TOKENS, "time");
