# next-preview-core — import plan

Requested by the user 2026-09-29. Written by session `npm-packages` (reviewer). Implemented by session `npm-changes`.

Goal: bring `@prismetic/next-preview-core` into this monorepo as a workspace, unchanged in behaviour.

## Facts (measured 2026-09-29)

| | |
|---|---|
| Latest on npm | `1.0.16`, published 2026-03-13 |
| Its own repo | `https://prismetic.visualstudio.com/PSM-Packages/_git/next-preview-core`, `main` = `dc2bd73` = `1.0.16` |
| Remote `main` vs npm `1.0.16` | identical: `src/`, README, `package.json`, `tsconfig.json`, `tsup.config.ts` |
| `/Users/toso/Downloads/next-preview-core` | **stale, `1.0.11`**. Do not use it as the source |
| Consumers | 27 ITE sites, all on `^1.0.16` (caret) |
| Build | `tsup`, dual output: `dist/index.js` (CJS), `dist/index.mjs` (ESM), `.d.ts`, `.d.mts`, each starting with `"use client";` |
| Source | `src/index.ts`, `src/withLivePreview.tsx`, `src/PreviewProviders.tsx`, 143 lines |
| Tests | none |

The 27 sites use a caret range, so the next publish reaches them on their next dependency update. Nothing in this stage may change what the package does.

## Rules

1. Work only inside `/Users/toso/Documents/Prismetic/npm-packges`.
2. No `git commit`, no `git push`, no `npm publish`, no branch switch.
3. No change to any other workspace. Their tests pass unedited.
4. `src/` is copied byte for byte. No refactor, no reformat, no comment edits.
5. Comments in new files: almost none.
6. Any deviation: stop and ask `npm-packages`.

## Stage A — faithful import

### Source

Take `1.0.16` from npm: `npm pack @prismetic/next-preview-core@1.0.16` in your scratchpad, then extract. It carries `src/`, `README.md`, `package.json`, `tsconfig.json`, `tsup.config.ts`.

### Copy into `next-preview-core/`

| Copy | Do not copy |
|---|---|
| `src/` (3 files) | `dist/` |
| `README.md` | `node_modules/` |
| `tsconfig.json` | `package-lock.json` |
| `tsup.config.ts` | `.git/`, `.DS_Store` |
| `package.json` | the package's own `.gitignore` |

Add `.gitignore` and `LICENSE` copied from `link-utils`.

### `package.json` changes

Keep `name`, `version` (`1.0.16`), `main`, `module`, `types`, `exports`, `peerDependencies`, `keywords`, `author`, `license` exactly as they are.

| Add | Value |
|---|---|
| `files` | `["dist"]` |
| `repository`, `homepage`, `bugs` | same shape as `link-utils`, `directory: "next-preview-core"` |
| `publishConfig` | `{ "access": "public" }` |
| `scripts.prepublishOnly` | `"tsup"` for now; tests join it in stage B |
| `devDependencies` | `react`, `react-dom` and `@tanstack/react-query`, so the workspace builds without relying on peer auto-install |

Keep `tsup` and the dual CJS + ESM output. Do not switch to `tsc`. Keep the package's own `typescript` and `tsup` ranges unless the build fails; if it does, report before changing them.

### Repo wiring

- Root `package.json`: add `next-preview-core` to `workspaces`, alphabetical.
- Root `README.md`: one row in the packages table.
- Root `package-lock.json`: `npm install --ignore-scripts`. List every package the lockfile gained.

### README

Two edits only:

- Replace the "Deployment" section with `npm publish -w next-preview-core` from the repo root.
- Replace the "Local Development (npm link)" paths so they work from the monorepo.

Everything else in the README stays as it is.

### Stage A done when

- `npm run build -w next-preview-core` is clean.
- The built `dist/index.js`, `dist/index.mjs`, `dist/index.d.ts` and `dist/index.d.mts` are compared with the `1.0.16` tarball's. Report each as identical or show the diff. A difference caused by a newer `tsup` is acceptable only if the exports, the `"use client";` first line and the runtime code are the same; say which lines differ.
- `npm pack --dry-run -w next-preview-core` lists `dist/`, `README.md`, `LICENSE`, `package.json` and nothing else.
- `cmp` of each `src/` file against the tarball's is clean.
- `npm test --workspaces --if-present` passes as before.

Report to `npm-packages` with: files added and changed, the dist comparison, the lockfile additions, every deviation, open questions. Then stop. Stage B starts only when `npm-packages` says so.

## Stage A — result

Done and approved 2026-09-29. `typescript` moved to `^6.0.3` with `"ignoreDeprecations": "6.0"`, because tsup loads the repo's TypeScript 6. JS output is byte-identical to `1.0.16`; the `.d.ts` files differ in 3 equivalent lines.

## Stage B — version 1.1.0

Approved by the user 2026-09-29: tests, an error state, customisable texts.

### Constraint

27 sites use `^1.0.16`, so they receive `1.1.0` on their next dependency update without editing code. A site that passes three arguments must see the same loading, not-found and data output as in `1.0.16`. The only visible change allowed for such a site is the error block (B3).

### B1. Characterisation tests first

Write these against the untouched `1.0.16` source, before any change, and keep them green afterwards.

- Fixture: `src/__fixtures__/withLivePreview-1.0.16.tsx`, a byte-identical copy of the current file, used as the reference.
- Setup: `vitest ^3.2.4`, `happy-dom` pinned exact `20.14.5`, `createRoot` + `act`, a real `QueryClient`. No `@testing-library`.
- `scripts.test`: `vitest run`. `prepublishOnly`: `vitest run && tsup`.

| # | Pins |
|---|---|
| T1 | Loading block: exact markup, inline style and the text `Loading preview...` |
| T2 | Not-found block when the fetcher resolves `null`: exact markup, style and `Page not found!` |
| T3 | Data render: `WrappedComponent` gets `{...props, ...data}`, data wins over a prop of the same name |
| T4 | The query key is `cacheKeyGenerator(props)` and the fetcher receives the props |
| T5 | `PreviewProviders` defaults: `staleTime` 300000, `refetchOnWindowFocus` false, `retry` 1 |
| T6 | With `refetchOnWindowFocus` true: `focus` and a visible `visibilitychange` refetch active queries; a hidden one does not; listeners are removed on unmount |
| T7 | With `refetchOnWindowFocus` false: no refetch on either event |
| T8 | The `QueryClient` is the same instance across re-renders |

### B2. Fourth argument

```ts
export type PreviewOutput<P> = React.ReactNode | ((props: P) => React.ReactNode);
export type PreviewErrorOutput<P> = React.ReactNode | ((props: P, error: unknown) => React.ReactNode);

export interface LivePreviewOptions<P> {
  loading?: PreviewOutput<P>;
  notFound?: PreviewOutput<P>;
  error?: PreviewErrorOutput<P>;
}

export function withLivePreview<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fetcherFn: (props: P) => Promise<any>,
  cacheKeyGenerator: (props: P) => any[],
  options?: LivePreviewOptions<P>,
): (props: P) => React.JSX.Element;
```

| # | Rule |
|---|---|
| O1 | An option left out gives the `1.0.16` block, byte for byte. |
| O2 | A string or number is the text inside the default block; the block's markup and style stay. This is the translation case. |
| O3 | Any other node replaces the default block entirely. `null` renders nothing. |
| O4 | A function is called with the component's props (and the error, for `error`) on each render; its result follows O2 and O3. |
| O5 | The first three parameters and their types do not change. Export `LivePreviewOptions`, `PreviewOutput`, `PreviewErrorOutput` from the index. |

### B3. Error state

Today a fetcher that throws ends as `Page not found!`.

| # | Rule |
|---|---|
| E1 | Render order: loading, then data when there is any, then the error block when the query has an error, then not-found. |
| E2 | Data from an earlier success wins over a later failed refetch: a working preview is never replaced by the error block. |
| E3 | Default error block: the not-found block's markup and style, text `Preview failed to load.`, and under it the error's `message` in a smaller font when the error is an `Error` with a non-blank message. |
| E4 | One `console.error("[preview] Fetch failed", queryKey, error)` per distinct error, from an effect, not from render. |
| E5 | `retry` is untouched: `PreviewProviders` still retries once before the error shows. |
| E6 | `queryFn` is `async () => (await fetcherFn(props)) ?? null`. A fetcher that resolves `undefined` gives not-found, as in `1.0.16`, with one request in both versions (measured: React Query never retried it). Two differences: React Query's "data cannot be undefined" log is gone, and the empty result is cached like a `null` result, so remounting within `staleTime` shows not-found without a refetch. `1.0.16` refetched on every mount in the `undefined` case only. Without this rule an `undefined` result would show the error block. |

### B4. Tests for the new behaviour

- O1 to O4 for each of `loading`, `notFound`, `error`: omitted, string, element, `null`, function.
- Without options, the loading, not-found and data output equal the `1.0.16` fixture's.
- E1 to E6: a throwing fetcher shows the default error block after the retry; the message line appears only for an `Error` with a message; `console.error` fires once and not during render; a failed refetch after a success keeps the data; a fetcher resolving `undefined` is called once and gives not-found.
- A type test: three-argument calls from `1.0.16` still compile; a wrong option key is an error.

### B5. README

- A section for the fourth argument, with the O2/O3 rule in a table and a translated example that reads `locale` from props.
- A section for the error state, with this limit stated plainly: the error block shows only when the fetcher throws. A fetcher that catches the error and returns `null` still gives not-found.
- A short "Upgrading to 1.1" section: what a three-argument site sees (E3 and E6, nothing else).
- Development section with the test command and count.

### B6. Version

`1.1.0` in `package.json` and the root lockfile entry. The lockfile may gain nothing: `vitest` and `happy-dom` are already in it. Report the delta.

### Stage B done when

- `npm test -w next-preview-core` passes and `npm run build -w next-preview-core` is clean.
- Both JS bundles still start with `"use client";`, and `require()` and `import()` both expose `PreviewProviders` and `withLivePreview`.
- `npm pack --dry-run` lists the same 7 files. No test or fixture file in `dist`.
- `src/PreviewProviders.tsx` is unchanged.
- `npm test --workspaces --if-present` passes as before.
- Mutation checks for E2, E6 and O1, each restored afterwards.

Report to `npm-packages`, then stop. No commit, no push, no publish.
