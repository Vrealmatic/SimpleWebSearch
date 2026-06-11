import pLimit from "p-limit";
import { crawlPage } from "./crawl-page.js";
import type { ResolvedOptions, SearchDocument, SearchFailure } from "../types.js";

export interface CrawlResult {
  documents: SearchDocument[];
  failures: SearchFailure[];
  skipped: number;
  withoutTitle: string[];
  withoutH1: string[];
  duplicateCanonicals: string[];
}

export async function crawlPages(urls: string[], options: ResolvedOptions): Promise<CrawlResult> {
  const limit = pLimit(options.crawler.concurrency);
  const documents: SearchDocument[] = [];
  const failures: SearchFailure[] = [];
  const withoutTitle: string[] = [];
  const withoutH1: string[] = [];
  let skipped = 0;
  await Promise.all(
    urls.map((url) =>
      limit(async () => {
        try {
          const result = await crawlPage(url, options);
          if (result.skipped || !result.document) {
            skipped++;
            return;
          }
          documents.push(result.document);
          if (result.usedFallbackTitle) withoutTitle.push(url);
          if (result.missingH1) withoutH1.push(url);
          if (options.verbose) console.log(`Indexed ${url}`);
        } catch (error: any) {
          failures.push({
            url,
            ...(typeof error?.status === "number" ? { status: error.status } : {}),
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    ),
  );
  documents.sort((a, b) => a.id.localeCompare(b.id));
  const duplicateCanonicals: string[] = [];
  const unique = new Map<string, SearchDocument>();
  for (const document of documents) {
    if (unique.has(document.id)) duplicateCanonicals.push(document.id);
    else unique.set(document.id, document);
  }
  return {
    documents: [...unique.values()],
    failures: failures.sort((a, b) => a.url.localeCompare(b.url)),
    skipped,
    withoutTitle: withoutTitle.sort(),
    withoutH1: withoutH1.sort(),
    duplicateCanonicals: [...new Set(duplicateCanonicals)].sort(),
  };
}
