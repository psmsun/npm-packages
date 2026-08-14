# @prismetic/form-utils

NeverBounce email gating for embedded ActiveCampaign forms, for React 19 / Next 16.

The AC form is injected by a remote script after render, so this waits for it rather than assuming it exists, then intercepts submission in the capture phase to hold the form until NeverBounce returns a verdict.

```bash
npm install @prismetic/form-utils
```

Requires the NeverBounce widget on the page — the package reads `window._nb`, it never owns the API key:

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

If `window._nb` never appears the hook gives up quietly after ~10s and the form submits unvalidated.

---

## Full usage

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

---

## `useNeverBounceEmailGate(containerRef, deps?)`

Wires NeverBounce onto whatever `<form>` appears inside `containerRef`.

| arg | type | |
| --- | --- | --- |
| `containerRef` | `RefObject<T \| null>` | element wrapping the injected AC markup |
| `deps` | `unknown[]` | re-run the wiring when these change — typically `[formId]` |

What it does:

- Watches for the AC form with a `MutationObserver`, and independently waits for `window._nb` (the bundle loads `afterInteractive`, so either can arrive first).
- Registers the email field with `registerListener(input, false)` — the widget's own blur feedback is suppressed in favour of the tooltip below.
- **On blur:** shows the verdict if there is one, otherwise shows `Verifying email…` and waits.
- **On submit:** if a verdict exists, blocks or allows. If none exists yet, holds the submission, shows `Please wait, verifying email…`, and re-fires the submit once the verdict lands.
- **Fails open.** After `NB_VERIFY_TIMEOUT_MS` (30s) with no verdict, the submission goes through. Holding back a real registrant costs more than letting one bounce through.
- Removes every listener, timer and tooltip on unmount.

## `useUtmIframe(formId, searchParams, deps?)`

For pages whose form is an embedded CRM iframe rather than an ActiveCampaign script. Appends UTM params to the iframe's `src` and keeps its height in sync with the embed's `postMessage`.

| arg | type | |
| --- | --- | --- |
| `formId` | `string \| number \| null` | id of the iframe the embed renders; falsy is a no-op |
| `searchParams` | `{ get(name): string \| null }` | Next's `useSearchParams()` satisfies this |
| `deps` | `unknown[]` | extra values that should re-run the wiring |

```tsx
const searchParams = useSearchParams();
useUtmIframe(props.data.FormId, searchParams, [isYandexForm]);
```

- UTMs come from the current URL when present, otherwise from the `utmParams` entry in `sessionStorage` — so a visitor who lands on a campaign URL and later navigates to the form keeps their attribution.
- The embed injects its iframe asynchronously, so this retries across up to 40 animation frames rather than assuming the element is already there.
- Picks the right separator (`?` vs `&`), so a src with no existing query string isn't corrupted.
- Reports a Yandex Metrica goal when the CRM posts `{ action: "form-sent", yandexCounterId, yandexCounterGoal }`. A no-op on sites without Metrica.

`searchParams` is passed in rather than read from `next/navigation` inside the package, which keeps `react` as the only peer dependency.

## `useFormContentFlags(html)`

Returns `{ isYandexForm, isFormContent }` — which provider the embed is, and whether it carries copy of its own (`p`/`span`/`label`) rather than just form controls. Both start `false` and settle after mount, since the parse needs a DOM.

## `HTMLContent`

Renders an HTML string with scripts executed, via `createContextualFragment` — the AC and Yandex embeds are `<script>` loaders, so `innerHTML` alone renders nothing. Adapted from `dangerously-set-html-content` for React 19.

| prop | type | default | |
| --- | --- | --- | --- |
| `html` | `string` | — | markup to inject |
| `allowRerender` | `boolean` | `false` | re-inject when `html` changes |

Any other prop passes through to the wrapping `div`.

---

## Validation helpers

| export | |
| --- | --- |
| `isAcceptable(response)` | whether an address may proceed |
| `getRejectMessage(response)` | user-facing reason it may not |
| `isValidEmail(email)` / `EMAIL_REGEX` | format check |
| `showValidationMessage(input, message, "error" \| "pending")` | draws AC's `_error _above` tooltip |
| `clearValidationMessage(input)` / `NB_ERROR_ID` | removes it |
| `NB_VERIFY_TIMEOUT_MS` `NB_POLL_INTERVAL_MS` | 30000 / 200 |

### How `isAcceptable` decides

It gates on evidence of a *bad* address rather than on `result` alone.

| response | verdict |
| --- | --- |
| `disposable_email` flag, or `result: "disposable"` | ✗ |
| `result: "invalid"` | ✗ |
| `result: "valid"` or `"catchall"` | ✓ |
| `result: "unknown"` + `has_dns_mx` | ✓ |
| `result: "unknown"`, no flags at all | ✓ |
| `result: "unknown"`, flags but no `has_dns_mx` | ✗ |

`unknown` is the case that matters. Many corporate mail gateways and hosts like rambler.ru greylist NeverBounce's SMTP probe, so a perfectly deliverable work address comes back `unknown` — an inconclusive check, not a bad address. Rejecting those blocks real registrants, so when the mailbox can't be confirmed the domain is judged instead. A domain with no mail exchanger has nowhere to deliver, and is still rejected.

---

## Types

`NeverBounceResponse` · `NeverBounceListener` · `NeverBounceWidget` · `HTMLContentProps` · `FormContentFlags`

Importing the package also declares `window._nb` globally, so no cast is needed to reach the widget.

---

## License

MIT
