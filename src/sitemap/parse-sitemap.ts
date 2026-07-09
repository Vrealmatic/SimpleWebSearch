import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, trimValues: true });

interface AlternateLink {
  "@_rel"?: unknown;
  "@_hreflang"?: unknown;
  "@_href"?: unknown;
}

interface SitemapEntry {
  loc?: unknown;
  link?: AlternateLink | AlternateLink[];
}

interface RawSitemap {
  urlset?: { url?: SitemapEntry | SitemapEntry[] };
  sitemapindex?: { sitemap?: SitemapEntry | SitemapEntry[] };
}

function list<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export type ParsedSitemap =
  | { type: "urlset"; locations: string[] }
  | { type: "index"; locations: string[] };

/**
 * Pick the location of a urlset entry. Without a hreflang filter this is the entry's
 * `<loc>`. With a filter it is the `<xhtml:link rel="alternate">` href matching the
 * requested hreflang; entries without a matching alternate are dropped.
 */
function entryLocation(entry: SitemapEntry, hreflang?: string): string {
  if (!hreflang) return typeof entry?.loc === "string" ? entry.loc : "";
  const wanted = hreflang.toLowerCase();
  const match = list(entry?.link).find(
    (link) =>
      String(link?.["@_rel"]).toLowerCase() === "alternate" &&
      String(link?.["@_hreflang"]).toLowerCase() === wanted,
  );
  return typeof match?.["@_href"] === "string" ? match["@_href"] : "";
}

export function parseSitemap(xml: string, sourceUrl: string, hreflang?: string): ParsedSitemap {
  let parsed: RawSitemap;
  try {
    parsed = parser.parse(xml) as RawSitemap;
  } catch (error) {
    throw new Error(
      `Invalid sitemap ${sourceUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!parsed.urlset && !parsed.sitemapindex)
    throw new Error(`Invalid sitemap ${sourceUrl}: expected urlset or sitemapindex`);
  const entries = parsed.urlset ? list(parsed.urlset.url) : list(parsed.sitemapindex?.sitemap);
  const locations = entries
    // The hreflang filter only applies to page entries; index entries have no alternates.
    .map((entry) => entryLocation(entry, parsed.urlset ? hreflang : undefined))
    .filter(Boolean)
    .map((location) => {
      try {
        return new URL(location, sourceUrl).href;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return { type: parsed.urlset ? "urlset" : "index", locations };
}
