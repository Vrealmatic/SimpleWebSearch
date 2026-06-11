import MiniSearch from "minisearch";
import { createTermProcessor } from "../stop-words.js";
import type { ResolvedOptions, SearchDocument } from "../types.js";

export const fields = ["title", "h1", "h2", "h3", "h4", "h5", "h6"] as const;
export const storeFields = ["title"] as const;

export function createIndex(
  documents: SearchDocument[],
  options: ResolvedOptions,
): MiniSearch<SearchDocument> {
  const search = new MiniSearch<SearchDocument>({
    fields: [...fields],
    storeFields: [...storeFields],
    processTerm: createTermProcessor(options.search.stopWords),
  });
  search.addAll(documents);
  return search;
}
