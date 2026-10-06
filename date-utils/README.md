# @prismetic/date-utils

> Built for Prismetic's ITE Strapi-backed Next.js sites. Replaces `moment` across
> the fleet. For every pattern it accepts, the output is byte-identical to
> moment 2.30.1 (English). The tests check this against moment itself in eight
> time zones.

Format CMS dates and times with moment's tokens, sort them, and format other
locales through `Intl`. No dependencies, and no moment in the bundle.

## Install

```bash
npm install @prismetic/date-utils
```

## Requirements

| | |
| --- | --- |
| Dependencies | none |
| Peer dependencies | **none at all**, not even React |
| Module format | ESM. `require()` works from CommonJS through Node's `require(esm)` (Node 20.19+ / 22.12+) |
| Side effects | none at import; `package.json` declares `"sideEffects": false` |
| Runs in | server components, client components, Node scripts |

## Quick start

```ts
import { compareDates, dateFormat, timeFormat } from "@prismetic/date-utils";

dateFormat("2025-10-14", "MMM Do, YYYY");                          // "Oct 14th, 2025"
dateFormat("2025-10-14T21:30:00.000Z", "DD.MM.YYYY", { utc: true }); // "14.10.2025"
dateFormat("2025-10-14T21:30:00.000Z", "DD.MM.YYYY");              // "15.10.2025" in Moscow
timeFormat("09:30:00.000", "LTS");                                 // "9:30:00 AM"
dateFormat(null, "DD.MM.YYYY");                                    // ""

["2025-10-15", "2025-10-13"].sort(compareDates);                   // ["2025-10-13", "2025-10-15"]
```

### Replacing moment

| moment | date-utils |
| --- | --- |
| `moment(value).format(pattern)` | `dateFormat(value, pattern)` |
| `moment.utc(value).format(pattern)` | `dateFormat(value, pattern, { utc: true })` |
| `moment(time, "HH:mm").format(pattern)` | `timeFormat(time, pattern)` |
| `moment(time, "HH:mm:ss").format("HH:mm")` | `timeFormat(time, "HH:mm")` |
| `.sort((a, b) => moment(a).diff(moment(b)))` | `.sort(compareDates)` |
| `.sort((a, b) => moment(a, "HH:mm").valueOf() - moment(b, "HH:mm").valueOf())` | `.sort(compareTimes)` |

### Sites with more than one locale

English keeps moment's tokens. Every other locale goes through `Intl`:

```ts
import { formatLocalizedDate, formatLocalizedTime } from "@prismetic/date-utils";

formatLocalizedDate(date, locale, "MMM Do, YYYY", { dateStyle: "long" });
// en    → "Oct 14th, 2025"
// zh-CN → "2025年10月14日"

formatLocalizedTime(time, locale, "LTS", { timeStyle: "medium" });
// en    → "6:05:00 PM"
// zh-CN → "18:05:00"
```

English is not formatted with `Intl` on purpose. `en-GB` writes September as
"Sept", and `Intl` puts a narrow no-break space (U+202F) before AM/PM, so the
output would no longer match what the sites render today.

## API reference

### `dateFormat(value, pattern, options?)`

```ts
dateFormat(value: string | null | undefined, pattern: string, options?: { utc?: boolean }): string
```

Formats a date or date-time string with [moment tokens](#tokens).

- Returns `""` for `null`, `undefined`, `""` and any value moment would call
  invalid, for example `2024-02-30`. It never throws because of a value.
- Throws a `RangeError` for a pattern it cannot render the way moment does, even
  when the value is empty. Patterns are code, so the mistake shows up in
  development or at build time, not on a live page.
- `utc: true` reads and renders the value in UTC, like `moment.utc(value)`.

How values are read:

| value | read as |
| --- | --- |
| `2025-10-14`, `2025-10`, `2025` | a calendar date at local midnight (UTC with `utc: true`), so the day is the same in every zone |
| `2025-10-14T09:30`, `…T09:30:00`, `…T09:30:00.000`, with `T` or a space | local time (UTC with `utc: true`) |
| the same, ending in `Z`, `+03:00`, `+0300` or `+03` | that instant, rendered in local time (UTC with `utc: true`) |
| impossible values: `2024-02-30`, `2023-02-29`, `T25:00`, `T12:60` | invalid, so `""` |
| anything else | the JavaScript engine's `Date` parser, which is moment's own fallback |

### `timeFormat(value, pattern)`

```ts
timeFormat(value: string | null | undefined, pattern: string): string
```

Formats a wall-clock time such as Strapi's `09:30:00.000`, like
`moment(value, "HH:mm").format(pattern)`.

- Reads `H:mm` or `HH:mm` at the start of the value. Seconds in the value are
  ignored, as with `moment(value, "HH:mm")`, so `LTS` always ends in `:00`.
- Returns `""` for a missing value or an hour above 23 or a minute above 59.
- Takes time tokens only (`H HH h hh m mm s ss A a LT LTS`). A date token throws,
  because a time has no date to show.
- Never depends on the time zone or on today's date.

### `compareDates(a, b)` / `compareTimes(a, b)`

```ts
compareDates(a: string | null | undefined, b: string | null | undefined): number
compareTimes(a: string | null | undefined, b: string | null | undefined): number
```

Comparators for `Array.prototype.sort`. `compareDates` returns the same number of
milliseconds as `moment(a).diff(moment(b))` and reads values the same way as
`dateFormat`. `compareTimes` compares `H:mm` / `HH:mm` values. Missing and invalid
values go last, in their original order.

```ts
["13:00", null, "9:05", "nope"].sort(compareTimes); // ["9:05", "13:00", null, "nope"]
```

### `formatLocalizedDate(value, locale, enFormat, options)` / `formatLocalizedTime(value, locale, enFormat, options)`

```ts
formatLocalizedDate(
  value: string | null | undefined,
  locale: string,
  enFormat: string,
  options: Intl.DateTimeFormatOptions,
): string
```

| param | |
| --- | --- |
| `locale` | a BCP 47 tag. `en` and `en-*` (any case) use `enFormat`; every other locale uses `Intl` |
| `enFormat` | the moment pattern for English, passed to `dateFormat` / `timeFormat` |
| `options` | `Intl.DateTimeFormat` options for every other locale |

- The language picks the path, not the site's default locale. A site whose
  default is `ru` still gets Russian month names on `ru` pages.
- A calendar date such as `2025-10-14` is formatted in UTC, so it shows the same
  day whatever `timeZone` the options carry. A date-time with a time keeps the
  options' `timeZone`, or the local zone if none is set.
- A time is formatted as a wall-clock value and never shifts with the zone or a
  DST change.
- Returns `""` for a missing or invalid value, like `dateFormat`. `Intl` throws
  on a malformed locale tag or conflicting options. Those are code mistakes, so
  they are not caught.

### Type exports

```ts
type DateFormatOptions = { utc?: boolean };
```

## Tokens

Shown for `2025-03-04T21:05:07Z` with `{ utc: true }`:

| | tokens |
| --- | --- |
| Year | `YYYY` 2025 · `YY` 25 |
| Month | `M` 3 · `Mo` 3rd · `MM` 03 · `MMM` Mar · `MMMM` March |
| Day of month | `D` 4 · `Do` 4th · `DD` 04 |
| Day of week | `d` 2 · `dd` Tu · `ddd` Tue · `dddd` Tuesday |
| Hour | `H` 21 · `HH` 21 · `h` 9 · `hh` 09 |
| Minute, second | `m` 5 · `mm` 05 · `s` 7 · `ss` 07 |
| AM/PM | `A` PM · `a` pm |
| Long forms | `LT` 9:05 PM · `LTS` 9:05:07 PM · `L` 03/04/2025 · `LL` March 4, 2025 · `LLL` March 4, 2025 9:05 PM · `LLLL` Tuesday, March 4, 2025 9:05 PM |
| Short long forms | `l` 3/4/2025 · `ll` Mar 4, 2025 · `lll` Mar 4, 2025 9:05 PM · `llll` Tue, Mar 4, 2025 9:05 PM |

Literal text goes in square brackets, and a backslash escapes one character:

```ts
dateFormat("2025-10-14", "[Week of] MMM D");            // "Week of Oct 14"
dateFormat("2025-10-14T09:05:00", "YYYY-MM-DD[T]HH:mm"); // "2025-10-14T09:05"
```

Every other letter throws a `RangeError`. That covers moment's tokens that are
not supported here (`Q`, `w`, `W`, `DDD`, `X`, `x`, `Z`, `k`, `S`, `E`, `gggg`,
and so on). It also covers letters moment would have printed literally:

```ts
dateFormat("2025-10-14", "YYYY-MM-DDTHH:mm");
// RangeError: @prismetic/date-utils: "T" is not a supported date token in "YYYY-MM-DDTHH:mm". Put literal text in [brackets].
```

Digits, punctuation, spaces and non-Latin text (`г.`, `年`) are literal. Because
the package uses moment's own tokenizer, a pattern splits into the same pieces as
in moment. `MMMMM` is `MMMM` + `M`, and `HHmmss` is `HH` + `mm` + `ss`.

## Differences from moment

- Invalid and missing values return `""`, not `"Invalid date"`.
- Unsupported tokens and stray letters throw instead of rendering something.
- Sorting puts missing and invalid values last. moment's `diff` returned `NaN`,
  which leaves the order up to the engine.
- `timeFormat` does not skip leading characters the way moment's lenient
  `"HH:mm"` parse did, so `" 09:30"` returns `""`.
- With `utc: true`, a non-ISO string without its own zone (`"March 10, 2024"`) is
  read in local time. `moment.utc` read it as UTC. ISO strings are not affected.
- English only. Other languages go through `formatLocalizedDate` /
  `formatLocalizedTime`.

## Changes from the copied `lib/date.ts`

Until this package, the 27 ITE sites each carried an identical `lib/date.ts`
(the API is unchanged), and pharmtech and Mosbuild also had
`lib/i18n/format.ts`. The package fixes these bugs in the copies:

- `2024-02-30` and `2023-02-29` rendered as 1 March, because V8's `Date` (Node
  and Chrome) rolls the extra days over. They now return `""` in every engine,
  like moment.
- `compareDates` read a date-only value as UTC midnight, where moment uses local
  midnight. Outside UTC, it could sort a date on the wrong side of a time from
  the same day or the day before. It now uses local midnight, like moment.
- `YYYY` zero-pads years below 1000, like moment.
- Tokens the copy did not know, such as `H`, `M` and `a`, were printed as
  letters. They now render or throw.
- `formatLocalizedTime` built the time on today's date in the local zone, so on
  the night clocks spring forward, `02:30` came out as `03:30`. It no longer
  shifts.
- `formatLocalizedDate` / `formatLocalizedTime` no longer import the site's
  `DEFAULT_LOCALE`. Drop that import when switching.

## Limits

- **Two zones only:** local and UTC. There is no `tz` support. Pass `timeZone` in
  the `Intl` options for other locales.
- **English names only** in token output.
- **ISO 8601 only as listed above.** Week dates (`2025-W42`), ordinal dates
  (`2025-287`), basic format (`20251014`) and six-digit years go to the engine's
  `Date` parser, which may read them differently from moment.

## Development

```bash
npm test -w date-utils     # vitest — 104 tests across 3 files, about 1 s
npm run build -w date-utils
```

The tests compare the output against moment 2.30.1 itself. moment is a pinned
devDependency and is never shipped. The tests switch `process.env.TZ` inside the
test process across UTC, Los Angeles, St. John's, São Paulo, Moscow, Kolkata,
Tokyo and Kiritimati. These cover half-hour offsets, the date line, and DST that
starts at midnight. The first test fails if zone switching stops working, so the
zone tests cannot pass by running in one zone.

| file | what it checks |
| --- | --- |
| `format.test.ts` | every token on every day of a leap year; the fleet's 15 patterns; escapes and literals; every pair of adjacent tokens; the tokens that throw |
| `date.test.ts` | in every zone: hand-picked DST, offset and edge inputs plus a three-year sweep; `""` exactly where moment is invalid; `compareDates` equal to moment's `diff`. Also every minute of the day through `timeFormat`, and `compareTimes` |
| `localized.test.ts` | English uses the tokens; other locales match `Intl` over moment's `Date` in every zone; calendar dates and times never shift |

To add a pattern a site uses, put it in `FLEET_PATTERNS` in
`src/__fixtures__/moment.ts`. To support a new token, add it to the map in
`src/format.ts` and to `DATE_TOKENS` or `TIME_TOKENS` in the fixture. The
adjacent-pair test then shows any pair that moment splits differently.
