import { extractHeadings, type ExtractionResult } from "../extractor/extract-headings.js";
import { fetchResource } from "../http.js";
import type { ResolvedOptions } from "../types.js";

function isHtmlLike(contentType: string): boolean {
  const type = contentType.toLowerCase();
  return !type || type.includes("html") || type.startsWith("text/");
}

export async function crawlPage(url: string, options: ResolvedOptions): Promise<ExtractionResult> {
  const resource = await fetchResource(url, {
    timeout: options.crawler.timeout,
    userAgent: options.crawler.userAgent,
    accept: "text/html",
  });
  if (!resource.ok) {
    throw Object.assign(new Error(`HTTP ${resource.status} ${resource.statusText}`), {
      status: resource.status,
    });
  }
  if (!isHtmlLike(resource.contentType)) {
    return { skipped: "non-html", usedFallbackTitle: false, missingH1: false };
  }
  const result = extractHeadings(resource.body.toString("utf8"), url, options.crawler);
  if (result.document && !options.crawler.absoluteIds) {
    const referenceOrigin = new URL(options.baseUrl ?? options.sitemap).origin;
    const documentUrl = new URL(result.document.id);
    if (documentUrl.origin === referenceOrigin) {
      result.document.id = `${documentUrl.pathname}${documentUrl.search}`;
    }
  }
  return result;
}
