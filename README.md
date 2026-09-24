# @prismetic packages

Monorepo for Prismetic's published npm packages. Managed with [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces); each package is versioned and released independently.

## Packages

| Package | Description |
| --- | --- |
| [`@prismetic/article-filters`](./article-filters) | Topic / year / sort filtering for CMS article lists — React 19 / Next 16 |
| [`@prismetic/form-utils`](./form-utils) | NeverBounce email gating for embedded ActiveCampaign forms — React 19 / Next 16 |
| [`@prismetic/link-utils`](./link-utils) | CMS href normalisation — bare domains, external targets, static-file prefetch |
| [`@prismetic/seo-utils`](./seo-utils) | Next.js metadata, JSON-LD and sitemap noIndex helpers for Strapi-backed sites — React 19 / Next 16 |
| [`@prismetic/text-utils`](./text-utils) | Render `[label](url)` links in plain-text CMS fields; demote rich-text `<h1>`s — React 19 / Next 16 |
| [`@prismetic/video-utils`](./video-utils) | YouTube and VK video ID extraction utilities |

## Development

```bash
npm install              # installs all workspaces into one hoisted node_modules
npm run test --workspaces --if-present
npm run build --workspaces --if-present
```

## Releasing

Versions are independent — never bump packages in lockstep. Publish one package at a time with the `-w` flag so the wrong workspace can't be published by accident:

```bash
npm version patch -w form-utils
npm publish -w form-utils
```

Each package's `prepublishOnly` hook runs its tests and build before the tarball is created.

## License

MIT
