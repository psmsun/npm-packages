# `@prismetic/form-utils` — upgrade plan

Everything deliberately left out of **v1.0.0**, which was a *pure extraction* of Securika `7f6c7a8` so the 27-site rollout had exactly one variable. Nothing here should ship until that rollout is verified in production.

Ordered by value-per-risk. Each item is independently shippable — resist bundling them, since bundling a refactor with a behaviour change is what caused the previous fleet-wide revert.

---

## 1. `useUtmIframe(formId, searchParams)` — ✅ SHIPPED in v1.1.0

> Done. Mosbuild's effect body was moved into the package verbatim — a 96-line diff showed only the `formId` parameterization. Items 2–5 below remain deliberately unshipped: 2 and 3 were never in production anywhere (they come from the attempt reverted on 2026-08-04), so they carry field risk that item 1 does not.

**The problem.** Nine sites tag an embedded CRM iframe with UTM params and resize it via `postMessage`. The code exists in two variants:

| variant | sites |
| --- | --- |
| **good** | Mosbuild, mosbuild-regional, miningWorld summit, world-food-summit, transrussia summit, Rosupack summit |
| **old, buggy** | **printech, Rosupack, world-food** |

**Four real bugs in the old variant:**

1. **Null-deref, asymmetric.** The `searchParams.size > 0` branch dereferences `(iframe as HTMLIFrameElement).src` with no null check, while the sessionStorage branch guards with `if (utmData && iframe)`. A visitor arriving with `?utm_source=…` before the embed injects its iframe throws a `TypeError` — and that is the *paid-traffic* path, the one that always carries UTMs.
2. **Always appends `&`** — `${src}&${utmData}`. If the src has no `?` the URL is malformed and the UTMs are silently lost.
3. **`querySelector(\`#${formId}\`)`** parses as a CSS selector and throws `SyntaxError` on a FormId starting with a digit. `getElementById` does not parse.
4. **`JSON.parse` unguarded** — corrupt sessionStorage throws.

Plus no retry: it looks for the iframe once on mount, so if the embed script has not injected yet, nothing is tagged at all.

**Ship the good variant**, which already fixes all four: `buildUtmQuery()`, a `requestAnimationFrame` retry loop (40 frames), `getElementById`, `try/catch`, a `typeof message !== "object"` guard, a `cancelled` cleanup flag, and `const sep = src.includes("?") ? "&" : "?"`.

**Design constraint — do not import `next` in the package.** The UTM code reads `useSearchParams` from `next/navigation`. Reading the router inside the package turns a plain React package (peer: `react` only) into a Next-only one. Pass the values in instead:

```tsx
// site keeps the one Next-specific line
const searchParams = useSearchParams();
useUtmIframe(props.data.FormId, searchParams);
```

**Open question before shipping:** Rosupack summit is the only good-variant site *without* the Yandex Metrica goal (`{action:"form-sent"}` → `ym(id, "reachGoal", goal)`). Adopting a shared hook makes it start firing Metrica goals on a live site. Confirm whether its absence is deliberate or just older code.

---

## 2. Event-driven verdicts — replaces both 200 ms polls

v1.0.0 polls `nbListenerRef.current?._response?.response` every `NB_POLL_INTERVAL_MS`, in two places. The widget can tell us directly instead:

- `forceUpdate(callback)` accepts a callback — no polling needed for the verify path.
- Dispatch `nb:result` / `nb:clear` CustomEvents on the input so blur and submit share one source of truth.
- Set `_NBSettings` to `"autoFieldHookup": false, "timeout": 10` so the widget stops racing our own handler and bounds its own wait.

This was verified end-to-end in Securika dev during the earlier attempt. It removes the 30 s fail-open timer in favour of the widget's own ~12.5 s client timeout.

⚠️ Requires editing `_NBSettings` in each site's `app/layout.tsx`, so it is **not** a package-only change. Budget a fleet pass.

---

## 3. `allow_entry` as the accept gate

NeverBounce ships `allow_entry` in every response — its own point-of-entry verdict, driven by the POE settings on the account. v1.0.0 ignores it and uses the flags heuristic instead.

Gating on `allow_entry === false` is simpler and moves policy into the NeverBounce dashboard rather than our code. Errors and throttling produce a verdict-ish object with `.response = {}` → `allow_entry` undefined → passes, which is the correct fail-open behaviour.

Ship this **only** with a way to compare against the flags heuristic first — it is the single highest-risk change here, because getting it wrong in either direction silently blocks or admits registrations without throwing.

---

## 4. Null-safe `useFormContentFlags`

Signature is `html: string`, and the body calls `html.includes(...)` — an `undefined` throws. Every consumer is `props: any`, so TypeScript catches nothing.

The 4 summit sites and world-food already work around it with `props.formHtml ?? ""` at the call site. Make the package tolerant (`html?: string | null`) and drop the workarounds.

Cheap, zero-risk, good candidate to ride along with 1.1.0.

---

## 5. Test the hook, not just the helpers

The 26 existing tests cover the pure functions. The genuinely tricky paths have no coverage: submit interception, the fail-open resubmit, timer cleanup on unmount, and the late-`window._nb` path.

Needs jsdom plus a stubbed NB widget. The widget's shape is undocumented — `_response.response`, `forceUpdate()`, `destroy()`, and `registerListener(input, false)` — so the stub is fiddly but small.

---

## Standing facts worth not rediscovering

- **The NeverBounce script sits inside `{!isPreview && (…)}`** in every `app/layout.tsx`. A `build:preview` deploy ships no NeverBounce at all, so a preview URL shows a green form that proves nothing. Verify on localhost only.
- **All 24 public keys are referrer-locked** — a bogus `Referer` returns `bad_referrer`; localhost is allowed. Any non-whitelisted host silently produces no verdict, which the fail-open path then masks.
- **pharmtech and all 4 summit sites load no NB script at all**, so the engine has never run there. They adopted the package for dedupe only.
- **Tooltip marker-class trap.** AC's `resizeTooltip` regex `/ ?(_above|_below) ?/` eats the adjacent space, so a marker class placed *after* `_above` fuses into `_error` and `clearValidationMessage` can never find the node again. Any marker class must **precede** the positional class. v1.0.0 is immune because it keys off `tooltip.id` (`NB_ERROR_ID`).
- **`registerListener(input, false)` still binds the widget's own form-submit gate**, which is why our handler uses `capture: true`.
- Widget version observed: `v0.17.17`. `poe/check` is JSONP: `/v4/poe/check?key=…&email=…&timeout=10&callback=cb` plus a `Referer` header.

---

## Release checklist

1. `npm test` (runs on `prepublishOnly` alongside `tsc`).
2. `npm version patch|minor` → `npm publish` from `form-utils/`.
3. Bump the exact pin in each consuming site's `package.json` — the fleet uses **exact pins, no caret**, because `npm install --package-lock-only` re-resolves ranges and would otherwise drift the engine silently.
4. `npm install --package-lock-only` per site to refresh the committed lockfile. Azure CI runs `npm install`, not `npm ci`.
5. Rebuild and redeploy — these are static exports on OSS and do not self-update. A bad publish stays live until every site is rebuilt.
