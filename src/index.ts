import { resolveOptions } from "./config.js";
import { discoverUrls } from "./sitemap/fetch-sitemap.js";
import { crawlPages } from "./crawler/crawl-pages.js";
import { createIndex } from "./index/create-index.js";
import { writeOutput } from "./index/write-output.js";
import type { GenerateResult, GeneratorOptions, SearchReport } from "./types.js";

export type {
  GenerateResult,
  GeneratorOptions,
  SearchDocument,
  SearchReport,
  SearchWeights,
} from "./types.js";
export { extractHeadings } from "./extractor/extract-headings.js";
export { parseSitemap } from "./sitemap/parse-sitemap.js";

/** Generate a MiniSearch index and audit files from all pages in a sitemap tree. */
export async function generateSearchIndex(input: GeneratorOptions): Promise<GenerateResult> {
  const options = resolveOptions(input);
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const urls = await discoverUrls(options.sitemap, options.crawler);
  const crawled = await crawlPages(urls, options);
  if (crawled.documents.length === 0)
    throw new Error(`No pages were successfully indexed from ${options.sitemap}`);
  const finished = Date.now();
  const report: SearchReport = {
    startedAt,
    finishedAt: new Date(finished).toISOString(),
    durationMs: finished - started,
    sitemapUrl: options.sitemap,
    discoveredUrls: urls.length,
    indexedUrls: crawled.documents.length,
    skippedUrls: crawled.skipped + crawled.duplicateCanonicals.length,
    failedUrls: crawled.failures.length,
    documentsWithoutTitle: crawled.withoutTitle,
    documentsWithoutH1: crawled.withoutH1,
    duplicateCanonicalUrls: crawled.duplicateCanonicals,
    failures: crawled.failures,
  };
  await writeOutput(createIndex(crawled.documents, options), crawled.documents, report, options);
  return { documents: crawled.documents, report, output: options.output };
}
