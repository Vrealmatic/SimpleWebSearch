import { gunzipSync } from "node:zlib";
import { fetchResource } from "../http.js";
import { parseSitemap } from "./parse-sitemap.js";

interface SitemapFetchOptions {
  timeout: number;
  userAgent: string;
  sameOrigin: boolean;
  /** Keep only URLs whose xhtml:link alternate matches this hreflang (e.g. "cs", "x-default"). */
  hreflang?: string;
  /** Move URLs found inside the sitemap onto this origin before fetching them. */
  crawlOrigin?: string;
}

/**
 * Move a URL onto `origin`, keeping its path, query, and hash. A dev server usually renders
 * its sitemap with production URLs, so without this the same-origin filter would discard
 * every entry.
 */
function toCrawlOrigin(location: string, origin?: string): string {
  if (!origin) return location;
  const url = new URL(location);
  return new URL(`${url.pathname}${url.search}${url.hash}`, origin).href;
}

function isGzip(body: Buffer): boolean {
  return body[0] === 0x1f && body[1] === 0x8b;
}

async function fetchText(url: string, options: SitemapFetchOptions): Promise<string> {
  try {
    const resource = await fetchResource(url, {
      timeout: options.timeout,
      userAgent: options.userAgent,
    });
    if (!resource.ok) throw new Error(`HTTP ${resource.status} ${resource.statusText}`);
    // Detect gzip by magic bytes; transparently encoded responses arrive already decompressed.
    return (isGzip(resource.body) ? gunzipSync(resource.body) : resource.body).toString("utf8");
  } catch (error) {
    throw new Error(
      `Unable to load sitemap ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function discoverUrls(
  sitemapUrl: string,
  options: SitemapFetchOptions,
): Promise<string[]> {
  const pending = [sitemapUrl];
  const visited = new Set<string>();
  const pages = new Set<string>();
  const origin = options.crawlOrigin ?? new URL(sitemapUrl).origin;
  while (pending.length) {
    const current = pending.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const parsed = parseSitemap(await fetchText(current, options), current, options.hreflang);
    if (parsed.type === "index") {
      // Nested sitemaps are listed with production URLs too, so they move as well.
      for (const child of parsed.locations.map((l) => toCrawlOrigin(l, options.crawlOrigin)).sort())
        if (!visited.has(child)) pending.push(child);
      continue;
    }
    for (const location of parsed.locations) {
      const url = new URL(toCrawlOrigin(location, options.crawlOrigin));
      if (
        (url.protocol === "http:" || url.protocol === "https:") &&
        (!options.sameOrigin || url.origin === origin)
      )
        pages.add(url.href);
    }
  }
  return [...pages].sort();
}
