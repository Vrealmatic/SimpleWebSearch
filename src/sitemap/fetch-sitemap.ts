import { gunzipSync } from "node:zlib";
import { parseSitemap } from "./parse-sitemap.js";

interface SitemapFetchOptions {
  timeout: number;
  userAgent: string;
  sameOrigin: boolean;
}

async function fetchText(url: string, options: SitemapFetchOptions): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": options.userAgent },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const gzip =
      url.toLowerCase().endsWith(".gz") || response.headers.get("content-type")?.includes("gzip");
    return (gzip ? gunzipSync(bytes) : bytes).toString("utf8");
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? `timed out after ${options.timeout}ms`
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(`Unable to load sitemap ${url}: ${reason}`);
  } finally {
    clearTimeout(timer);
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
    const parsed = parseSitemap(await fetchText(current, options), current);
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
