import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, trimValues: true });

function list<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export type ParsedSitemap =
  | { type: "urlset"; locations: string[] }
  | { type: "index"; locations: string[] };

export function parseSitemap(xml: string, sourceUrl: string): ParsedSitemap {
  let parsed: any;
  try {
    parsed = parser.parse(xml);
  } catch (error) {
    throw new Error(
      `Invalid sitemap ${sourceUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const root = parsed.urlset ?? parsed.sitemapindex;
  if (!root) throw new Error(`Invalid sitemap ${sourceUrl}: expected urlset or sitemapindex`);
  const entries = parsed.urlset ? list(root.url) : list(root.sitemap);
  const locations = entries
    .map((entry: any) => (typeof entry?.loc === "string" ? entry.loc : ""))
    .filter(Boolean)
    .map((location: string) => {
      try {
        return new URL(location, sourceUrl).href;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return { type: parsed.urlset ? "urlset" : "index", locations };
}
