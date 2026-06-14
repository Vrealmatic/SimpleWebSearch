import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import type { GeneratorOptions, ResolvedOptions, SearchField, SearchWeights } from "./types.js";
import { resolveStopWords } from "./stop-words.js";

export const defaultFields: SearchField[] = ["title", "h1", "h2", "h3", "h4", "h5", "h6"];

export const defaultWeights: SearchWeights = {
  title: 12,
  h1: 10,
  h2: 6,
  h3: 4,
  h4: 2,
  h5: 1,
  h6: 1,
};

export async function loadConfig(path: string): Promise<GeneratorOptions> {
  const absolute = resolve(path);
  const jiti = createJiti(pathToFileURL(absolute).href, { interopDefault: true });
  return (await jiti.import(absolute, { default: true })) as GeneratorOptions;
}

export function resolveOptions(options: GeneratorOptions): ResolvedOptions {
  if (!options.sitemap) throw new Error("A sitemap URL is required");
  if (!options.output) throw new Error("An output directory is required");
  const excluded = options.crawler?.excludeSelector ?? [
    "nav",
    "footer",
    "script",
    "style",
    "noscript",
    "template",
    "[data-search-ignore]",
  ];
  return {
    sitemap: new URL(options.sitemap, options.baseUrl).href,
    output: resolve(options.output),
    crawler: {
      concurrency: options.crawler?.concurrency ?? 5,
      timeout: options.crawler?.timeout ?? 15_000,
      includeSelector: options.crawler?.includeSelector ?? "body",
      excludeSelector: Array.isArray(excluded) ? excluded.join(", ") : excluded,
      sameOrigin: options.crawler?.sameOrigin ?? true,
      useCanonical: options.crawler?.useCanonical ?? true,
      absoluteIds: options.crawler?.absoluteIds ?? false,
      skipNoindex: options.crawler?.skipNoindex ?? true,
      userAgent: options.crawler?.userAgent ?? "heading-search-index/0.1",
    },
    weights: { ...defaultWeights, ...options.weights },
    search: {
      fields: resolveFields(options.search?.fields),
      prefix: options.search?.prefix ?? true,
      fuzzy: options.search?.fuzzy ?? 0.2,
      stopWords: resolveStopWords(options.search?.stopWords),
    },
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    client: options.client ?? false,
    pretty: options.pretty ?? false,
    verbose: options.verbose ?? false,
  };
}

export function resolveFields(fields: SearchField[] | undefined): SearchField[] {
  const resolved = fields?.length ? [...new Set(fields)] : defaultFields;
  for (const field of resolved) {
    if (!defaultFields.includes(field)) {
      throw new Error(`Unsupported search field "${field}"`);
    }
  }
  return resolved;
}

export function mergeOptions(
  base: Partial<GeneratorOptions>,
  cli: Partial<GeneratorOptions>,
): GeneratorOptions {
  return {
    ...base,
    ...cli,
    crawler: { ...base.crawler, ...cli.crawler },
    weights: { ...base.weights, ...cli.weights },
    search: { ...base.search, ...cli.search },
  } as GeneratorOptions;
}
