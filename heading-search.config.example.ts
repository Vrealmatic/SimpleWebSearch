export default {
  sitemap: "https://example.com/sitemap.xml",
  output: "./public/search",
  crawler: {
    concurrency: 5,
    timeout: 15_000,
    includeSelector: "main",
    excludeSelector: ["nav", "footer", "[data-search-ignore]"],
    absoluteIds: false,
  },
  search: {
    fields: ["title", "h1", "h2", "h3", "h4", "h5", "h6"],
    prefix: true,
    fuzzy: 0.2,
    stopWords: "en",
  },
  weights: { title: 12, h1: 10, h2: 6, h3: 4, h4: 2, h5: 1, h6: 1 },
};
