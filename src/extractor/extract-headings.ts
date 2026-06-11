import * as cheerio from "cheerio";
import type { SearchDocument } from "../types.js";

export interface ExtractionResult {
  document?: SearchDocument;
  skipped?: "noindex";
  usedFallbackTitle: boolean;
  missingH1: boolean;
}

function clean(value: string): string {
  // HTML parser decodes entities; this removes invisible formatting and control code points.
  return value
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]/g, " ") // eslint-disable-line no-control-regex
    .replace(/\s+/g, " ")
    .trim();
}

export function extractHeadings(
  html: string,
  pageUrl: string,
  options: {
    includeSelector: string;
    excludeSelector: string;
    useCanonical: boolean;
    skipNoindex: boolean;
  },
): ExtractionResult {
  const $ = cheerio.load(html);
  const robots = $("meta[name='robots' i]").attr("content") ?? "";
  if (
    options.skipNoindex &&
    robots.split(",").some((part) => part.trim().toLowerCase() === "noindex")
  ) {
    return { skipped: "noindex", usedFallbackTitle: false, missingH1: false };
  }
  const scope = $(options.includeSelector);
  scope.find(options.excludeSelector).remove();
  scope.filter(options.excludeSelector).remove();
  const values = (level: number): string => {
    const seen = new Set<string>();
    scope
      .find(`h${level}`)
      .add(scope.filter(`h${level}`))
      .each((_, element) => {
        const text = clean($(element).text());
        if (text) seen.add(text);
      });
    return [...seen].join(" ");
  };
  const headings = {
    h1: values(1),
    h2: values(2),
    h3: values(3),
    h4: values(4),
    h5: values(5),
    h6: values(6),
  };
  const rawTitle = clean($("title").first().text());
  const page = new URL(pageUrl);
  const fallback = headings.h1 || page.pathname || "/";
  let id = page.href;
  if (options.useCanonical) {
    const canonical = $("link[rel~='canonical' i]").attr("href");
    if (canonical) {
      try {
        id = new URL(canonical, page).href;
      } catch {
        /* ignore malformed canonical */
      }
    }
  }
  return {
    document: {
      id,
      title: rawTitle || fallback,
      ...headings,
    },
    usedFallbackTitle: !rawTitle,
    missingH1: !headings.h1,
  };
}
