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

/** Load a generated index and attach debounced search behavior to an input. */
export async function attachSearch(options: SearchClientOptions): Promise<() => void> {
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
