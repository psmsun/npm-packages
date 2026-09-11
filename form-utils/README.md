# @prismetic/form-utils

> Built for Prismetic's ITE sites, whose registration pages embed an
> ActiveCampaign form injected by a remote script. The hooks assume that shape.

NeverBounce email gating for embedded ActiveCampaign forms, for React 19 / Next 16.

The AC form is injected by a remote script after render, so this waits for it
rather than assuming it exists, then intercepts submission in the capture phase
to hold the form until NeverBounce returns a verdict.

## Install

```bash
npm install @prismetic/form-utils
```

## Requirements

**1. The NeverBounce widget must be on the page.** The package reads
`window._nb`; it never owns the API key:

```jsx
<Script
  id="neverbounce"
  strategy="afterInteractive"
  dangerouslySetInnerHTML={{
    __html: `_NBSettings = {"apiKey": "public_…"};`,
  }}
/>
<Script
  id="neverbounce-script-cdn"
  strategy="afterInteractive"
  src="https://cdn.neverbounce.com/widget/dist/NeverBounce.js"
/>
```

If `window._nb` never appears the hook gives up quietly after ~10s
(50 polls × 200ms) and the form submits unvalidated.

**2. Import the stylesheet:**

```css
/* globals.css */
@import "@prismetic/form-utils/styles.css";
```

It styles the injected ActiveCampaign markup under a `.container-registration`
root — field layout, the `_error _above` tooltip this package draws, and the
Yandex form variant. Your site owns typography and colour; the sheet owns
structure. It is optional: the hooks work without it, the form just renders
unstyled.

**3. Everything else:**

| | |
| --- | --- |
| Peer | `react >=18` — accurate as declared; nothing here uses a React 19-only API |
| Dependencies | none |
| Next.js | not a peer dep, never imported — `useUtmIframe` takes `searchParams` as an argument instead |
| `"use client"` | already in the source of every hook and of `HTMLContent`; you do not add it |
| Tested against | React 19 / Next 16 |

## Quick start

```tsx
const containerRef = useRef<HTMLDivElement>(null);
useNeverBounceEmailGate(containerRef, [formId]);

return (
  <div ref={containerRef}>
    <HTMLContent html={acFormMarkup} />
  </div>
);
```

The ref wraps the container the AC script injects into; the hook finds the
`<form>` inside it on its own.

### Real-world usage

```tsx
"use client";

import { useRef } from "react";
import {
  HTMLContent,
  useFormContentFlags,
  useNeverBounceEmailGate,
} from "@prismetic/form-utils";
import { cn } from "@/lib/utils";
import Consent from "./Consent";

const Form = (props: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isYandexForm, isFormContent } = useFormContentFlags(props.data.Data);
  useNeverBounceEmailGate(containerRef, [props.data.id]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "container",
        isYandexForm ? "yandex-form-style" : "form-style",
        isFormContent ? "" : "py-0!",
      )}
    >
      <HTMLContent
        html={props.data.Data}
        id={props.data.id}
        key={props.data.id}
      />
      <Consent />
    </div>
  );
};

export default Form;
```

## API reference

### `useNeverBounceEmailGate(containerRef, deps?)`

```ts
useNeverBounceEmailGate<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  deps?: unknown[],
): void
```

| param | type | default | |
| --- | --- | --- | --- |
| `containerRef` | `RefObject<T \| null>` | — | element wrapping the injected AC markup |
| `deps` | `unknown[]` | `[]` | re-run the wiring when these change — typically `[formId]` |

Returns nothing. Wires NeverBounce onto whatever `<form>` appears inside
`containerRef`.

**The email field** is found with
`input[name="email"], input[type="email"], input[id="email"]` — the first match
wins. A form whose email input matches none of those is left unwired.

What it does:

- Watches for the AC form with a `MutationObserver`, and independently waits for
  `window._nb` (the bundle loads `afterInteractive`, so either can arrive first).
- Registers the email field with `registerListener(input, false)` — the widget's
  own blur feedback is suppressed in favour of the tooltip below.
- **On input:** clears any visible message, via a delegated listener on the form.
- **On blur:** shows the verdict if there is one, otherwise shows
  `Verifying email…` and waits. Empty and format-invalid values are skipped
  entirely so AC handles its own required-field messaging.
- **On submit:** if a verdict exists, blocks or allows. If none exists yet, holds
  the submission, shows `Please wait, verifying email…`, and re-fires the submit
  once the verdict lands.
- **Fails open.** After `NB_VERIFY_TIMEOUT_MS` (30s) with no verdict, the
  submission goes through. Holding back a real registrant costs more than letting
  one bounce through.
- Removes every listener, timer and tooltip on unmount.

The submit listener is registered with `capture: true` so it runs before
ActiveCampaign's own handler.

---

### `useUtmIframe(formId, searchParams, deps?)`

```ts
useUtmIframe(
  formId: string | number | null | undefined,
  searchParams: UtmSearchParams,
  deps?: unknown[],
): void
```

For pages whose form is an embedded CRM iframe rather than an ActiveCampaign
script. Appends UTM params to the iframe's `src` and keeps its height in sync
with the embed's `postMessage`.

| param | type | default | |
| --- | --- | --- | --- |
| `formId` | `string \| number \| null \| undefined` | — | `id` of the iframe the embed renders; falsy is a no-op |
| `searchParams` | `UtmSearchParams` | — | anything with `get(name): string \| null`; Next's `useSearchParams()` satisfies it |
| `deps` | `unknown[]` | `[]` | extra values that should re-run the wiring |

```tsx
const searchParams = useSearchParams();
useUtmIframe(props.data.FormId, searchParams, [isYandexForm]);
```

- The five keys read are `utm_campaign`, `utm_content`, `utm_medium`,
  `utm_source`, `utm_term`. Values are `encodeURIComponent`-escaped.
- UTMs come from the current URL when **any** key is present there; otherwise
  from the `utmParams` entry in `sessionStorage` (a JSON object) — so a visitor
  who lands on a campaign URL and later navigates to the form keeps their
  attribution. Malformed JSON is swallowed and treated as no UTMs.
- The embed injects its iframe asynchronously, so this retries across up to 40
  animation frames rather than assuming the element is already there. The src is
  appended to **once**.
- Picks the right separator (`?` vs `&`), so a src with no existing query string
  isn't corrupted.
- Listens for `message` events: `{ height }` sets the iframe's pixel height, and
  `{ action: "form-sent", yandexCounterId, yandexCounterGoal }` reports a Yandex
  Metrica goal via `window.ym`. A no-op on sites without Metrica.

`searchParams` is passed in rather than read from `next/navigation` inside the
package, which keeps `react` as the only peer dependency.

---

### `useFormContentFlags(html)`

```ts
useFormContentFlags(html: string): FormContentFlags
```

| param | type | |
| --- | --- | --- |
| `html` | `string` | the raw embed markup from the CMS |

Returns `{ isYandexForm, isFormContent }`:

| field | true when |
| --- | --- |
| `isYandexForm` | the markup contains the substring `yandexcloud` |
| `isFormContent` | parsing the markup yields at least one `p`, `span` or `label` |

Both start `false` and settle after mount, since the parse needs a DOM. Plan for
one render at `false` — that first paint is what a static export ships.

---

### `<HTMLContent />`

```tsx
<HTMLContent html={...} allowRerender={...} {...divProps} />
```

Renders an HTML string **with its scripts executed**, via
`createContextualFragment` — the AC and Yandex embeds are `<script>` loaders, so
`innerHTML` alone renders nothing. Adapted from `dangerously-set-html-content`
for React 19.

| prop | type | default | |
| --- | --- | --- | --- |
| `html` | `string` | — | markup to inject |
| `allowRerender` | `boolean` | `false` | re-inject when `html` changes |

Any other prop passes through to the wrapping `div`. With `allowRerender: false`
the markup is injected once and later `html` changes are ignored; remount with a
`key` to force a fresh injection, as the real-world example above does.

An empty `html` logs `html prop can't be null` to the console and injects
nothing.

---

### Validation helpers

#### `isAcceptable(response)`

```ts
isAcceptable(response: NeverBounceResponse): boolean
```

Whether an address may proceed. See [How `isAcceptable` decides](#how-isacceptable-decides).

#### `getRejectMessage(response)`

```ts
getRejectMessage(response: NeverBounceResponse): string
```

The user-facing reason an address may not proceed. First match wins:

| condition | message |
| --- | --- |
| `disposable_email` flag or `result: "disposable"` | `Disposable email addresses are not accepted. Please use another address.` |
| `suggested_correction` present | `Did you mean <correction>?` |
| `result: "invalid"` | `This email address doesn't appear to exist. Please check for typos.` |
| `result: "unknown"` without `has_dns_mx` | `This domain can't receive email. Please check the address.` |
| anything else | `Please enter a valid email address.` |

The `suggested_correction` row is checked early on purpose — the API often spots
the typo for us, which is far more useful than a generic rejection.

#### `isValidEmail(email)` / `EMAIL_REGEX`

```ts
isValidEmail(email: string): boolean
```

A format check only — no network call. `EMAIL_REGEX` is exported so a site can
apply the identical rule elsewhere:

```ts
/^[+_a-z0-9-'&=]+(\.[+_a-z0-9-']+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,})$/i
```

Used as a gate before every NeverBounce call: a malformed address never reaches
the API, and AC's own required-field handling deals with it.

#### `showValidationMessage(input, message, type)`

```ts
showValidationMessage(
  input: HTMLInputElement,
  message: string,
  type: "error" | "pending",
): void
```

Draws AC's `_error _above` tooltip below the input's parent, matching
ActiveCampaign's own styling so the two are indistinguishable. Clears any
existing message first.

| `type` | appearance | side effect |
| --- | --- | --- |
| `"error"` | red `#FFDDDD`, warning icon | adds `_has_error` to the input |
| `"pending"` | amber `#FFF9E6`, clock icon | none |

The tooltip is given `role="alert"` and flips to `_below` when the input sits
within 40px of the viewport top.

#### `clearValidationMessage(input)` / `NB_ERROR_ID`

```ts
clearValidationMessage(input: HTMLInputElement): void
```

Removes the tooltip — looked up by `NB_ERROR_ID`
(`"nb-email-validation-error"`) on the whole document, which is the reliable
route given AC re-renders its own markup — and strips `_has_error` from the
input.

#### Timing constants

| export | value | |
| --- | --- | --- |
| `NB_VERIFY_TIMEOUT_MS` | `30000` | how long to wait for a verdict before failing open |
| `NB_POLL_INTERVAL_MS` | `200` | how often the verdict is polled |

30s is deliberate: the widget itself waits `_NBSettings.timeout * 1000 + 2500`
(27.5s at the default timeout of 25), so anything shorter gives up while a check
is still in flight. Greylisting hosts routinely take 11–13s to answer.

### Type exports

`NeverBounceResponse` · `NeverBounceListener` · `NeverBounceWidget` ·
`HTMLContentProps` · `FormContentFlags` · `UtmSearchParams`

```ts
interface NeverBounceResponse {
  result: "valid" | "invalid" | "disposable" | "catchall" | "unknown";
  status: string;
  flags?: string[];              // has_dns, has_dns_mx, smtp_connectable,
                                 // accepts_all, free_email_host, role_account,
                                 // disposable_email, spamtrap_network
  allow_entry?: boolean;         // NeverBounce's own POE verdict; not read here
  suggested_correction?: string;
  execution_time?: number;
}
```

Importing the package also declares `window._nb` globally, so no cast is needed
to reach the widget.

## How `isAcceptable` decides

It gates on evidence of a *bad* address rather than on `result` alone.

| response | verdict |
| --- | --- |
| `disposable_email` flag, or `result: "disposable"` | ✗ |
| `result: "invalid"` | ✗ |
| `result: "valid"` or `"catchall"` | ✓ |
| `result: "unknown"` + `has_dns_mx` | ✓ |
| `result: "unknown"`, no flags at all | ✓ |
| `result: "unknown"`, flags but no `has_dns_mx` | ✗ |

`unknown` is the case that matters. Many corporate mail gateways and hosts like
rambler.ru greylist NeverBounce's SMTP probe, so a perfectly deliverable work
address comes back `unknown` — an inconclusive check, not a bad address.
Rejecting those blocks real registrants, so when the mailbox can't be confirmed
the domain is judged instead. A domain with no mail exchanger has nowhere to
deliver, and is still rejected.

No flags at all is treated as ✓ for the same reason: it means the API gave up
before gathering any evidence, and absence of evidence isn't grounds to reject.

## Limits

- **A held submission is re-fired by clicking `button[type="submit"]`.** A form
  whose submit control is an `<input type="submit">`, or a button without
  `type="submit"`, will have its first submission held and then never resumed —
  the visitor sees the pending tooltip clear and nothing happen. Every AC form in
  the fleet renders a `<button type="submit">`.
- **`useUtmIframe` does not check `event.origin`.** Any window with a handle to
  the page can post `{ height }` to resize the iframe, or
  `{ action: "form-sent", … }` to fire a Metrica goal. Low impact, but it is not
  a validated channel.
- **Messages are hardcoded English.** `getRejectMessage` and the two inline
  strings (`Verifying email…`, `Please wait, verifying email…`) take no
  translation, which is visible on the Russian-language sites.
- **One form per container.** The hook wires the first `<form>` it finds and
  disconnects its observer; a container that injects a second form later is not
  picked up.
- **The gate is client-side only.** It improves data quality at the point of
  entry; it is not a security control, and a determined submitter can bypass it.
- **`isAcceptable`'s `has_dns_mx && smtp_connectable` branch is redundant** — the
  fall-through returns the same verdict for any `has_dns_mx` response. Harmless,
  but it reads as if it does more than it does.

## Development

```bash
npm test -w form-utils     # vitest — 26 tests
npm run build -w form-utils
```

Tests cover `form-utils.ts` — the pure validation helpers. The four hooks and
`HTMLContent` have no automated coverage; they need a DOM, a remote script and a
third-party widget.

## License

MIT
