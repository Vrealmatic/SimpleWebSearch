# Simple Web Search / heading search index

Framework-independent Node.js 20+ tool that follows a sitemap tree, extracts page titles and `h1`–`h6` headings, and writes a browser-loadable MiniSearch index plus audit files. It reads server-rendered HTML only; it does not execute JavaScript.

- Try it live
  - basic integration: [vrealmatic.com](https://vrealmatic.com/)
  - integration with form fallback: [PacoGames.com](https://www.pacogames.com/)

## Installation and CLI

```bash
npm install --save-dev heading-search-index
npx heading-search-index --sitemap https://example.com/sitemap.xml --output ./public/search
```

All options: `--sitemap`, `--output`, `--fields`, `--include-selector`, `--exclude-selector`, `--concurrency`, `--timeout`, `--base-url`, `--user-agent`, `--hreflang`, `--crawl-origin`, `--no-skip-noindex`, `--stop-words`, `--no-client`, `--config`, `--pretty`, `--verbose`. Sitemap and output are required unless supplied by a config file. CLI values override config values.

`includeSelector` limits extraction to a page region (e.g. `main`). `excludeSelector` removes elements inside that region before extraction (e.g. breadcrumbs, sidebars, `[data-search-ignore]`).

For multilingual sitemaps with `xhtml:link rel="alternate"` annotations, `--hreflang` (or `crawler.hreflang` in config) keeps only the alternate URL matching the given language (e.g. `cs`, `en`, `x-default`); entries without a matching alternate are skipped. To build one index per language, run the generator once per language over the same sitemap with different `--hreflang` and `--output` values. Without the option, alternates are ignored and every `<loc>` is indexed as before.

### Indexing a local dev server

A dev server usually renders its sitemap with production URLs, so pointing `--sitemap` at `localhost` finds nothing: every entry is discarded by the same-origin filter. `--crawl-origin` (or `crawler.crawlOrigin` in config) moves the URLs found inside the sitemap — including nested sitemap indexes — onto the given origin, keeping path, query, and hash. Only what the sitemap contains is moved; `--sitemap` itself is fetched exactly as given.

```bash
npx heading-search-index \
  --sitemap http://localhost:3000/sitemap.xml \
  --crawl-origin http://localhost:3000 \
  --base-url https://example.com \
  --output ./public/search
```

This crawls the dev server while `--base-url` keeps document IDs relative: pages served locally normally still emit a production `<link rel="canonical">`, and IDs are shortened to a path only when they sit on the base URL's origin. Without `--base-url`, the canonical wins and IDs stay absolute production URLs — still usable, just longer. The point of the combination is being able to index pages that exist locally but are not deployed yet, and ship the generated files in the same deploy as the pages themselves.

Pages carrying a robots `noindex` meta tag are skipped by default; pass `--no-skip-noindex` (or set `crawler.skipNoindex: false` in config) to index them anyway, which is what you want on a staging or pre-launch site.

A ready-to-serve browser ESM bundle (`search-client.js`) that includes MiniSearch is written alongside the index by default, so the generated directory works as a static deployment with no bundler in the consuming site. Pass `--no-client` (or set `client: false` in config) to skip it — useful when the site imports `heading-search-index/client` through its own bundler and the extra file would only be dead weight in the build output.

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
    // crawlOrigin: "http://localhost:3000",
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

Run with `npx heading-search-index --config heading-search.config.ts`. `search.stopWords` accepts `"en"`, `"cs"`, comma-separated CLI additions (`--stop-words en,free,games`), or a config array (`["the", "and"]`). Stop words are applied at index-build time and baked into `search-config.json` so the browser client uses the same terms automatically.

## Generated output

```text
public/search/
├── search-client.js      ← browser bundle, omitted with --no-client
├── search-index.json     ← serialized MiniSearch index
├── search-config.json    ← fields, boosts, search defaults
├── search-documents.json ← readable audit data (not needed at runtime)
└── search-report.json    ← timings, counts, failures
```

Deploy at minimum `search-client.js`, `search-index.json`, and `search-config.json` as static assets. Generation writes to a temporary sibling directory and replaces the destination only after all files have been written successfully.

## Browser integration

### Markup

The element-form API reads `data-search-base-url` and `data-empty-text` from the container and locates child elements by `data-search-input`, `data-search-results`, `data-search-message`, `data-search-list`, and `data-search-trigger`. Everything else — class names, IDs, ARIA attributes, surrounding `<form>` — is up to you.

Wrapping the input in a `<form>` with a server-side `action` gives a no-JavaScript fallback: if the bundle hasn't loaded yet, submitting the form navigates to the search results page normally. Once the bundle activates, the JavaScript client intercepts input events and the form is never submitted.

**Minimal example** (list of pages, no form fallback):

```html
<div data-site-search data-search-base-url="/search/" data-empty-text="No results.">
  <input type="search" autocomplete="off" aria-label="Search" data-search-input />
  <div data-search-results hidden aria-live="polite">
    <p data-search-message></p>
    <ul data-search-list></ul>
  </div>
</div>
```

**With form fallback** — the `action` serves as a progressive-enhancement fallback when JavaScript is unavailable or slow:

```html
<div data-site-search data-search-base-url="/search/en/" data-empty-text="No results.">
  <form role="search" data-search-form action="/api/search" method="get">
    <button type="button" aria-label="Open search" data-search-trigger>…</button>
    <input
      name="q" type="search" role="combobox"
      autocomplete="off" aria-autocomplete="list"
      aria-expanded="false" aria-controls="search-results"
      placeholder="Search…" aria-label="Search the website"
      data-search-input
    />
  </form>
  <div id="search-results" data-search-results hidden role="region" aria-live="polite">
    <p data-search-message></p>
    <ul data-search-list></ul>
  </div>
</div>
```

### Lazy-load bootstrap

Preloads on `pointerenter`; `focus` is the keyboard/touch fallback.

**Element form** — pass the container directly; the client reads `data-search-base-url`, `data-empty-text`, and child elements automatically:

```ts
const searches = new WeakMap<HTMLElement, Promise<unknown>>();

const activate = (area: HTMLElement) => {
  let loading = searches.get(area);
  if (loading) return loading;

  loading = import("/search/search-client.js")
    .then(({ attachSearch }) => attachSearch(area))
    .catch((err) => {
      console.error(err);
      searches.delete(area);
      const panel = area.querySelector("[data-search-results]");
      const message = area.querySelector("[data-search-message]");
      if (panel && message) {
        message.textContent = area.dataset.errorText ?? "";
        (panel as HTMLElement).hidden = false;
      }
    });

  searches.set(area, loading);
  return loading;
};

for (const area of document.querySelectorAll<HTMLElement>("[data-site-search]")) {
  area.addEventListener("pointerenter", () => activate(area), { once: true });
  area.querySelector("[data-search-input]")
      ?.addEventListener("focus", () => activate(area), { once: true });
}
```

**Options form** — pass an explicit options object for custom result rendering (e.g. when using a framework component):

```ts
import("/search/search-client.js").then(({ attachSearch }) =>
  attachSearch({
    input,
    baseUrl: "/search/",
    onResults(items) {
      output.replaceChildren(
        ...items.map((item) => {
          const a = document.createElement("a");
          a.href = String(item.id);
          a.textContent = String(item.title);
          return a;
        }),
      );
    },
  }),
);
```

### Multi-locale

Keep one shared `search-client.js` and generate separate data directories per locale:

```text
public/search/search-client.js
public/search/en/search-index.json
public/search/en/search-config.json
public/search/cs/search-index.json
public/search/cs/search-config.json
```

Set `data-search-base-url` per locale in the element form, or pass `baseUrl` in the options form:

```ts
attachSearch({ input, baseUrl: `/search/${locale}/`, onResults });
```

Stop words differ per locale but are baked into each `search-config.json`, so the client loads and applies them automatically. Use explicit `indexUrl` / `configUrl` only when your deployment layout requires non-standard file names.

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
      .then(({ attachSearch }) =>
        attachSearch({ input: input.current!, onResults: setResults }),
      )
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
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Development

Clone the repo and install dependencies, then build with [tsup](https://tsup.egoist.dev/):

```bash
npm install
npm run build      # → dist/ (index.js, cli.js, and the browser bundle client.js)
```

`npm run build` compiles `src/` into `dist/`. The browser entry `src/client.ts` is bundled into `dist/client.js` with MiniSearch inlined (`noExternal: ["minisearch"]`), so the result is a self-contained ESM file that needs no further bundling on the consuming site.

Other scripts: `npm test` (Vitest), `npm run typecheck`, `npm run lint`, `npm run format`.

### Updating the deployed browser client

`search-client.js` shipped to a site is just a copy of `dist/client.js`. After changing `src/client.ts` (for example the result markup in `attachSearch`), regenerate and redeploy it:

```bash
npm run build
# then either re-run the CLI to emit a fresh search-client.js…
npx heading-search-index --sitemap https://example.com/sitemap.xml --output ./public/search
# …or just copy the rebuilt bundle directly:
cp dist/client.js ./public/search/search-client.js
```

Editing `src/client.ts` alone changes nothing served — the bundle must be rebuilt. Replacing `search-client.js` is sufficient only if the site loads this bundle and calls `attachSearch`; a site using its own custom render function must update that script instead.

## Behavior and limitations

Sitemap indexes are followed recursively with cycle protection, URL deduplication, namespace support, relative URL resolution, and gzip support. Individual page errors are recorded without stopping other pages. `noindex` pages are skipped by default. URLs that respond with a non-HTML content type (for example PDFs listed in the sitemap) are counted as skipped, not indexed. Canonical links define document IDs. IDs on the reference origin — `baseUrl` when set, otherwise the sitemap's origin — are relative paths by default; IDs on other origins remain absolute to avoid collisions. Set `crawler.absoluteIds` to `true` to retain absolute IDs everywhere.

Only HTML returned by the server is indexed. Headings rendered exclusively in the browser by client JavaScript are unavailable; render important content through SSR or static generation. This tool does not interpret `robots.txt`, execute JavaScript, or crawl links outside the sitemap.
