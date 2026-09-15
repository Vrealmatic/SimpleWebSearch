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
  if (options.verbose) console.log(`Discovered ${urls.length} URLs from ${options.sitemap}`);
  if (urls.length === 0)
    throw new Error(
      options.crawler.hreflang
        ? `No URLs found in ${options.sitemap} with an hreflang "${options.crawler.hreflang}" alternate`
        : `No URLs found in ${options.sitemap}`,
    );
  const crawled = await crawlPages(urls, options);
  if (crawled.documents.length === 0) {
    const skipped = crawled.skipped + crawled.duplicateCanonicals.length;
    const first = crawled.failures[0];
    throw new Error(
      `No pages were successfully indexed from ${options.sitemap} ` +
        `(discovered ${urls.length}, skipped ${skipped}, failed ${crawled.failures.length})` +
        (first
          ? `; first failure: ${first.url}${first.status ? ` [${first.status}]` : ""} — ${first.message}`
          : ""),
    );
  }
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
