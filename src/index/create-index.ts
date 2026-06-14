import MiniSearch from "minisearch";
import { createTermProcessor } from "../stop-words.js";
import type { ResolvedOptions, SearchDocument } from "../types.js";

export const storeFields = ["title"] as const;

export function createIndex(
  documents: SearchDocument[],
  options: ResolvedOptions,
): MiniSearch<SearchDocument> {
  const search = new MiniSearch<SearchDocument>({
    fields: options.search.fields,
    storeFields: [...storeFields],
    processTerm: createTermProcessor(options.search.stopWords),
  });
  search.addAll(documents);
  return search;
}
