import { gunzipSync } from "node:zlib";
import { fetchResource } from "../http.js";
import { parseSitemap } from "./parse-sitemap.js";

interface SitemapFetchOptions {
  timeout: number;
  userAgent: string;
  sameOrigin: boolean;
  /** Keep only URLs whose xhtml:link alternate matches this hreflang (e.g. "cs", "x-default"). */
  hreflang?: string;
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
  const origin = new URL(sitemapUrl).origin;
  while (pending.length) {
    const current = pending.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const parsed = parseSitemap(await fetchText(current, options), current, options.hreflang);
    if (parsed.type === "index") {
      for (const child of parsed.locations.sort()) if (!visited.has(child)) pending.push(child);
      continue;
    }
    for (const location of parsed.locations) {
      const url = new URL(location);
      if (
        (url.protocol === "http:" || url.protocol === "https:") &&
        (!options.sameOrigin || url.origin === origin)
      )
        pages.add(url.href);
    }
  }
  return [...pages].sort();
}
