import { extractHeadings, type ExtractionResult } from "../extractor/extract-headings.js";
import type { ResolvedOptions } from "../types.js";

export async function crawlPage(url: string, options: ResolvedOptions): Promise<ExtractionResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.crawler.timeout);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": options.crawler.userAgent, accept: "text/html" },
      signal: controller.signal,
    });
    if (!response.ok)
      throw Object.assign(new Error(`HTTP ${response.status} ${response.statusText}`), {
        status: response.status,
      });
    const result = extractHeadings(await response.text(), url, options.crawler);
    const referenceOrigin = new URL(options.baseUrl ?? options.sitemap).origin;
    if (result.document) {
      const documentUrl = new URL(result.document.id);
      if (!options.crawler.absoluteIds && documentUrl.origin === referenceOrigin) {
        result.document.id = `${documentUrl.pathname}${documentUrl.search}`;
      }
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error(`Request timed out after ${options.crawler.timeout}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
