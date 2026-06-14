import { copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type MiniSearch from "minisearch";
import { storeFields } from "./create-index.js";
import type { ResolvedOptions, SearchDocument, SearchReport, SearchWeights } from "../types.js";

export async function writeOutput(
  index: MiniSearch<SearchDocument>,
  documents: SearchDocument[],
  report: SearchReport,
  options: ResolvedOptions,
): Promise<void> {
  const parent = dirname(options.output);
  const temporary = join(parent, `.${basename(options.output)}-${process.pid}-${Date.now()}`);
  const space = options.pretty ? 2 : undefined;
  await mkdir(parent, { recursive: true });
  try {
    await mkdir(temporary, { recursive: true });
    const config = {
      fields: options.search.fields,
      storeFields: [...storeFields],
      searchOptions: {
        boost: pickActiveBoost(options),
        prefix: options.search.prefix,
        fuzzy: options.search.fuzzy,
        stopWords: options.search.stopWords,
      },
    };
    await Promise.all([
      writeFile(join(temporary, "search-index.json"), JSON.stringify(index, null, space)),
      writeFile(join(temporary, "search-documents.json"), JSON.stringify(documents, null, space)),
      writeFile(join(temporary, "search-config.json"), JSON.stringify(config, null, space)),
      writeFile(join(temporary, "search-report.json"), JSON.stringify(report, null, space)),
    ]);
    if (options.client) {
      await copyFile(new URL("./client.js", import.meta.url), join(temporary, "search-client.js"));
    }
    await rm(options.output, { recursive: true, force: true });
    await rename(temporary, options.output);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw new Error(
      `Unable to write index to ${options.output}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function pickActiveBoost(options: ResolvedOptions): Partial<SearchWeights> {
  return Object.fromEntries(
    options.search.fields.map((field) => [field, options.weights[field]]),
  ) as Partial<SearchWeights>;
}
