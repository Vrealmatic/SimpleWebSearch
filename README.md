# heading-search-index

Framework-independent Node.js 20+ tool that follows a sitemap tree, extracts page titles and `h1`-`h6` headings, and writes a browser-loadable MiniSearch index plus audit files. It reads server-rendered HTML only; it does not execute JavaScript.

- Try it live at [vrealmatic.com](https://vrealmatic.com/)

## Installation and CLI

```bash
npm install --save-dev heading-search-index
npx heading-search-index --sitemap https://example.com/sitemap.xml --output ./public/search
```

```bash
heading-search-index \
  --sitemap https://example.com/sitemap.xml \
  --output ./public/search \
  --fields title,h1,h2,h3,h4,h5,h6 \
  --include-selector main \
  --exclude-selector "nav, footer, [data-search-ignore]" \
  --concurrency 5 --timeout 15000 --stop-words en,custom-word --client --pretty --verbose
```

Options are `--sitemap`, `--output`, `--fields`, `--include-selector`, `--exclude-selector`, `--concurrency`, `--timeout`, `--base-url`, `--user-agent`, `--stop-words`, `--client`, `--config`, `--pretty`, and `--verbose`. Sitemap and output are required unless supplied by a config file. CLI values override config values.

Use CLI flags for one-off generation. Use `heading-search.config.ts` when the command becomes long or repeated. `src/config.ts` is only internal package code that loads the config file, applies defaults, and lets CLI flags override the file.

`includeSelector` and `excludeSelector` solve different problems. `includeSelector` chooses the page region to inspect, for example `main`. `excludeSelector` removes unwanted elements inside that region before extraction, for example breadcrumbs, sidebars, CTAs, or `[data-search-ignore]`.

## Step-by-step implementation guide

### 1. Install or build the tool

In a consuming website project, install the package and run it with `npx`:

```bash
npm install --save-dev heading-search-index
npx heading-search-index --help
```

When developing this package locally from the repository, build it first and run the compiled CLI:

```bash
npm install
npm run build
node dist/cli.js --help
```

### 2. Generate the search files

For a simple static deployment, generate the browser client together with the data files:

```bash
npx heading-search-index \
  --sitemap https://www.pacogames.com/sitemap/en \
  --output ./public/search \
  --fields h1 \
  --stop-words en,free,game,games,play,online,html5,browser,paco,pacogames \
  --client
```

If you are running from this repository before publishing the package, use the same flags with `node dist/cli.js`:

```bash
node dist/cli.js \
  --sitemap https://www.pacogames.com/sitemap/en \
  --output ./public/search \
  --fields h1 \
  --stop-words en,free,game,games,play,online,html5,browser,paco,pacogames \
  --client
```

### 3. Check the generated output

With `--output ./public/search --client`, the browser bundle is here:

```text
public/search/search-client.js
```

If `public/` is your web root, the browser URL is:

```text
/search/search-client.js
```

The generated directory contains:

```text
public/search/
├── search-client.js
├── search-index.json
├── search-config.json
├── search-documents.json
└── search-report.json
```

For runtime search, deploy at least:

```text
/search/search-client.js
/search/search-index.json
/search/search-config.json
```

`search-documents.json` and `search-report.json` are useful for audits and debugging, but the browser client does not need them.

### 4. Add HTML markup

```html
<div data-search>
  <input type="search" autocomplete="off" data-search-input />
  <div data-search-results aria-live="polite"></div>
</div>
```

### 5. Lazy-load the search client

This small bootstrap can live in your normal site JavaScript. It preloads search on hover and also works for keyboard/touch users through `focus`:

```ts
const area = document.querySelector<HTMLElement>("[data-search]");
const input = area?.querySelector<HTMLInputElement>("[data-search-input]");
const output = area?.querySelector<HTMLElement>("[data-search-results]");

if (area && input && output) {
  let loading: Promise<void> | undefined;

  const activate = () => {
    loading ??= import("/search/search-client.js")
      .then(({ attachSearch }) =>
        attachSearch({
          input,
          onResults(items) {
            output.replaceChildren(
              ...items.map((item) => {
                const link = document.createElement("a");
                link.href = String(item.id);
                link.textContent = String(item.title);
                return link;
              }),
            );
          },
        }),
      )
      .then(() => undefined);
    return loading;
  };

  area.addEventListener("pointerenter", activate, { once: true });
  input.addEventListener("focus", activate, { once: true });
}
```

You do not need to run `esbuild` in the consuming website when `--client` is used. `search-client.js` is already a browser-ready ESM bundle and includes MiniSearch.

### 6. Multi-locale layout

Use one shared client and separate data files per locale:

```text
public/search/search-client.js
public/search/en/search-index.json
public/search/en/search-config.json
public/search/cs/search-index.json
public/search/cs/search-config.json
```

Then pass locale-specific URLs:

```ts
attachSearch({
  input,
  indexUrl: `/search/${locale}/search-index.json`,
  configUrl: `/search/${locale}/search-config.json`,
  onResults,
});
```

The client can stay the same even when stop words differ by locale, because stop words are loaded from each locale's `search-config.json`.

## Configuration

```ts
// heading-search.config.ts
export default {
  sitemap: "https://example.com/sitemap.xml",
  output: "./public/search",
  crawler: {
    concurrency: 5,
    timeout: 15_000,
    includeSelector: "main",
    excludeSelector: ["nav", "footer", "[data-search-ignore]"],
    sameOrigin: true,
    useCanonical: true,
    absoluteIds: false,
    skipNoindex: true,
  },
  search: {
    fields: ["title", "h1", "h2", "h3", "h4", "h5", "h6"],
    prefix: true,
    fuzzy: 0.2,
    stopWords: "en",
  },
  weights: { title: 12, h1: 10, h2: 6, h3: 4, h4: 2, h5: 1, h6: 1 },
};
```

Run it with `npx heading-search-index --config heading-search.config.ts`. By default only page URLs on the sitemap origin are indexed. Set `crawler.sameOrigin` to `false` to allow other origins.

`search.fields` controls what is indexed. Use `--fields h1` when only page `h1` headings should be searchable. `search.stopWords` accepts the built-in `"en"` and `"cs"` presets, comma-separated CLI additions such as `--stop-words en,free,games`, or a custom config array such as `["the", "and", "company"]`. Stop words are removed while building the index and the generated client configuration applies the same term processor when loading and searching it.

Example for an English game site that should search only `h1` headings:

```bash
heading-search-index \
  --sitemap https://www.pacogames.com/sitemap/en \
  --output ./public/search/en \
  --fields h1 \
  --stop-words en,free,game,games,play,online,html5,browser
```

## Node.js API

```ts
import { generateSearchIndex } from "heading-search-index";

const result = await generateSearchIndex({
  sitemap: "https://example.com/sitemap.xml",
  output: "./public/search",
  crawler: { concurrency: 5, includeSelector: "main" },
});
console.log(result.report);
```

`generateSearchIndex` and all public option, document, weight, result, and report types are exported from the package root.

## Output

- `search-index.json`: serialized MiniSearch index.
- `search-documents.json`: deterministic, readable audit data. It is not needed by the browser search.
- `search-config.json`: fields, stored fields, boosts, and search defaults needed by the client.
- `search-report.json`: timings, counts, missing headings, canonical duplicates, skips, and failures.
- `search-client.js`: optional browser ESM bundle written when `--client` is used.

Write the directory during the build and deploy it as static assets. Generation uses a temporary sibling directory and only replaces the destination after all four files have been written.

## Lazy browser deployment

The initial page only needs a small bootstrap listener. On the first `pointerenter` over the search area, it starts loading the client module before the user clicks. The `focus` listener is an accessibility and touch-device fallback.

The lazy client then downloads:

1. `search-index.json`, which contains the searchable index and stored `id` and `title` fields.
2. `search-config.json`, which contains fields, boosts, prefix, and fuzzy settings.

`search-documents.json` is intentionally not downloaded at runtime. It is a readable audit artifact; searching it directly would duplicate data and discard the prebuilt MiniSearch index.

```html
<div data-search>
  <label for="site-search">Search</label>
  <input id="site-search" type="search" autocomplete="off" data-search-input />
  <div data-search-results aria-live="polite"></div>
</div>
```

If the site has a bundler, the bootstrap can import the package client and let the bundler create the lazy chunk:

```ts
const area = document.querySelector<HTMLElement>("[data-search]");
const input = area?.querySelector<HTMLInputElement>("[data-search-input]");
const output = area?.querySelector<HTMLElement>("[data-search-results]");

if (area && input && output) {
  let loading: Promise<void> | undefined;

  const activate = () => {
    loading ??= import("heading-search-index/client")
      .then(({ attachSearch }) =>
        attachSearch({
          input,
          onResults(items) {
            output.replaceChildren(
              ...items.map((item) => {
                const link = document.createElement("a");
                link.href = String(item.id);
                link.textContent = String(item.title);
                return link;
              }),
            );
          },
        }),
      )
      .then(() => undefined);
    return loading;
  };

  area.addEventListener("pointerenter", activate, { once: true });
  input.addEventListener("focus", activate, { once: true });
}
```

If the site does not bundle this TypeScript module, generate a ready-to-serve browser bundle with `--client` and import that static file instead:

```bash
heading-search-index \
  --sitemap https://example.com/sitemap.xml \
  --output ./public/search \
  --client
```

```ts
const activate = () => {
  loading ??= import("/search/search-client.js")
    .then(({ attachSearch }) => attachSearch({ input, onResults }))
    .then(() => undefined);
  return loading;
};
```

This is the same `search-client.js` described in the step-by-step guide above.

`attachSearch` installs a debounced `input` listener, searches with field boosts and prefix matching, enables fuzzy matching from four characters, and returns a cleanup function. Its defaults are `/search/search-index.json`, `/search/search-config.json`, 150 ms debounce, and 10 results. See [`examples/lazy-search`](./examples/lazy-search) for the complete framework-independent example.

For Next.js, put the same bootstrap in a client component. The dynamic import keeps both `heading-search-index/client` and MiniSearch out of the initial JavaScript chunk.

## Next.js / React example

```tsx
"use client";
import type { SearchResult } from "heading-search-index/client";
import { useEffect, useRef, useState } from "react";

export function SiteSearch() {
  const input = useRef<HTMLInputElement>(null);
  const loading = useRef<Promise<void>>();
  const cleanup = useRef<() => void>();
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => () => cleanup.current?.(), []);

  function activate() {
    loading.current ??= import("heading-search-index/client")
      .then(({ attachSearch }) => attachSearch({ input: input.current!, onResults: setResults }))
      .then((detach) => {
        cleanup.current = detach;
      });
    return loading.current;
  }

  return (
    <div onPointerEnter={activate}>
      <input ref={input} type="search" onFocus={activate} />
      <ul>
        {results.map((result) => (
          <li key={result.id}>
            <a href={String(result.id)}>{String(result.title)}</a>
            <small>{String(result.id)}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Behavior and limitations

Sitemap indexes are followed recursively with cycle protection, URL deduplication, namespace support, relative URL resolution, and gzip support. Individual page errors are recorded without stopping other pages. `noindex` pages are skipped by default. Canonical links define document IDs. IDs on the sitemap origin are relative paths by default; IDs on other origins remain absolute to avoid collisions. Set `crawler.absoluteIds` to `true` to retain absolute IDs everywhere.

Only HTML returned by the server is indexed. Headings rendered exclusively in the browser by client JavaScript are unavailable; render important content through SSR or static generation. This tool does not interpret `robots.txt`, execute JavaScript, or crawl links outside the sitemap.
