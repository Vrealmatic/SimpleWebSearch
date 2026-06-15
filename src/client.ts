import MiniSearch, { type SearchResult } from "minisearch";
import { createTermProcessor } from "./stop-words.js";

export type { SearchResult } from "minisearch";

interface SearchConfig {
  fields: string[];
  storeFields: string[];
  searchOptions: {
    boost: Record<string, number>;
    prefix: boolean;
    fuzzy: number | boolean;
    stopWords: string[];
  };
}

export interface SearchClientOptions {
  input: HTMLInputElement;
  baseUrl?: string;
  indexUrl?: string;
  configUrl?: string;
  debounceMs?: number;
  limit?: number;
  onResults: (results: SearchResult[], query: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Attach debounced search to an input element (options form), or wire up a
 * complete `[data-site-search]` container element (element form).
 *
 * **Element form** – pass the area element directly.  All configuration is
 * read from `data-*` attributes and child selectors:
 *
 *   data-search-base-url   – base URL for resolveAssetUrls
 *   data-empty-text        – message shown when query returns no results
 *   [data-search-input]    – the <input> element (required)
 *   [data-search-results]  – the results panel wrapper (required)
 *   [data-search-message]  – inline message node (required)
 *   [data-search-list]     – <ul> that receives result <li> items (required)
 *   [data-search-trigger]  – button that focuses the input (optional)
 *
 * **Options form** – pass a `SearchClientOptions` object (original API).
 */
export async function attachSearch(area: HTMLElement): Promise<() => void>;
export async function attachSearch(options: SearchClientOptions): Promise<() => void>;
export async function attachSearch(
  areaOrOptions: HTMLElement | SearchClientOptions,
): Promise<() => void> {
  if ("onResults" in areaOrOptions) {
    return attachSearchWithOptions(areaOrOptions);
  }
  return attachSearchToElement(areaOrOptions as HTMLElement);
}

async function attachSearchToElement(area: HTMLElement): Promise<() => void> {
  const input = area.querySelector<HTMLInputElement>("[data-search-input]");
  const panel = area.querySelector<HTMLElement>("[data-search-results]");
  const message = area.querySelector<HTMLElement>("[data-search-message]");
  const list = area.querySelector<HTMLElement>("[data-search-list]");
  const trigger = area.querySelector<HTMLElement>("[data-search-trigger]");

  if (!input || !panel || !message || !list) {
    throw new Error(
      "attachSearch: required child elements ([data-search-input], [data-search-results], " +
        "[data-search-message], [data-search-list]) not found inside the area element.",
    );
  }

  const emptyText = area.dataset.emptyText ?? "";

  const onResults = (results: SearchResult[], query: string): void => {
    list.innerHTML = "";
    if (!query) {
      panel.hidden = true;
      return;
    }
    if (results.length === 0) {
      message.textContent = emptyText;
      message.hidden = false;
      list.hidden = true;
    } else {
      message.textContent = "";
      message.hidden = true;
      list.hidden = false;
      for (const result of results) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = String(result.id);
        a.textContent = String(result.title ?? result.id);
        li.appendChild(a);
        list.appendChild(li);
      }
    }
    panel.hidden = false;
  };

  const handleTrigger = (): void => input.focus();
  trigger?.addEventListener("click", handleTrigger);

  const handleFocusOut = (e: FocusEvent): void => {
    if (!area.contains(e.relatedTarget as Node | null)) {
      panel.hidden = true;
    }
  };
  area.addEventListener("focusout", handleFocusOut);

  const detach = await attachSearchWithOptions({
    input,
    ...(area.dataset.searchBaseUrl !== undefined
      ? { baseUrl: area.dataset.searchBaseUrl }
      : {}),
    onResults,
  });

  return () => {
    detach();
    trigger?.removeEventListener("click", handleTrigger);
    area.removeEventListener("focusout", handleFocusOut);
  };
}

async function attachSearchWithOptions(options: SearchClientOptions): Promise<() => void> {
  const urls = resolveAssetUrls(options);
  const [indexResponse, configResponse] = await Promise.all([
    fetch(urls.indexUrl),
    fetch(urls.configUrl),
  ]);

  if (!indexResponse.ok) {
    throw new Error(`Unable to load search index: HTTP ${indexResponse.status}`);
  }
  if (!configResponse.ok) {
    throw new Error(`Unable to load search config: HTTP ${configResponse.status}`);
  }

  const [serializedIndex, config] = await Promise.all([
    indexResponse.text(),
    configResponse.json() as Promise<SearchConfig>,
  ]);
  const search = MiniSearch.loadJSON(serializedIndex, {
    fields: config.fields,
    storeFields: config.storeFields,
    processTerm: createTermProcessor(config.searchOptions.stopWords ?? []),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const query = options.input.value.trim();
        const results = query
          ? search
              .search(query, {
                boost: config.searchOptions.boost,
                prefix: config.searchOptions.prefix,
                fuzzy: query.length >= 4 ? config.searchOptions.fuzzy : false,
                combineWith: "AND",
              })
              .slice(0, options.limit ?? 10)
          : [];
        options.onResults(results, query);
      } catch (error) {
        options.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }, options.debounceMs ?? 150);
  };

  const handleInput = (): void => run();

  options.input.addEventListener("input", handleInput);
  if (options.input.value) run();

  return () => {
    clearTimeout(timer);
    options.input.removeEventListener("input", handleInput);
  };
}

export function resolveAssetUrls(
  options: Pick<SearchClientOptions, "baseUrl" | "indexUrl" | "configUrl">,
): {
  indexUrl: string;
  configUrl: string;
} {
  const base = options.baseUrl
    ? options.baseUrl.endsWith("/")
      ? options.baseUrl
      : `${options.baseUrl}/`
    : "/search/";
  return {
    indexUrl: options.indexUrl ?? `${base}search-index.json`,
    configUrl: options.configUrl ?? `${base}search-config.json`,
  };
}
