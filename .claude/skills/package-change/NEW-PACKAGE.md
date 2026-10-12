# New package

Read before writing the verdict for a new `@prismetic/*` package.

## Template

Pick the existing package closest to the new one (React or not, ships CSS or not, number of entry points) and copy its `package.json`, `tsconfig.json`, `.gitignore`, `LICENSE` and README skeleton. Name the template and the reason in the verdict.

Most packages share one shape: ESM, `tsc` to `dist/`, vitest in `src/*.test.ts`, `files: ["dist"]`, `prepublishOnly: "vitest run && tsc"`. date-utils and link-utils are the plainest. next-preview-core (tsup, dual CJS/ESM) and video-utils (plain JS, hand-written types) are outliers; copy one only for the same need, and say why.

## Fields to set

- `name` `@prismetic/<dir>`; `repository.directory` and `homepage` pointing at `<dir>`
- `version` `1.0.0`, or `0.1.0` for an API still settling; state which in the verdict
- `sideEffects` set explicitly: `false`, or `["*.css"]` when it ships CSS
- React packages: `react >=18` as a peer; `react`, `react-dom` and `@types/react` as devDependencies

## README

Follow the template's skeleton. The Requirements table and the Development section (test command with tool and count, build command, what the tests prove) are mandatory.

## Root files

- root `package.json` `workspaces`, alphabetical
- root `package-lock.json`: run `npm install` at the root so npm writes the workspace and `node_modules/@prismetic/<dir>` link entries
- root `README.md` packages table: alphabetical, one-line description, no version
