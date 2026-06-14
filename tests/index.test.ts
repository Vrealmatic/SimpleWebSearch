import { describe, expect, it } from "vitest";
import MiniSearch from "minisearch";
import { createIndex, storeFields } from "../src/index/create-index.js";
import { resolveOptions } from "../src/config.js";
import { createTermProcessor } from "../src/stop-words.js";
import type { SearchDocument } from "../src/types.js";

const blank = { h2: "", h3: "", h4: "", h5: "", h6: "" };
const documents: SearchDocument[] = [
  { id: "/title", title: "Needle", h1: "", ...blank },
  { id: "/h1", title: "Other", h1: "Needle", ...blank },
  { id: "/h2", title: "Other", h1: "", h2: "Needle", h3: "", h4: "", h5: "", h6: "" },
];

describe("MiniSearch index", () => {
  it("serializes, reloads, supports prefixes, and ranks by field boost", () => {
    const options = resolveOptions({ sitemap: "https://example.com/sitemap.xml", output: "out" });
    const index = createIndex(documents, options);
    const loaded = MiniSearch.loadJSON<SearchDocument>(JSON.stringify(index), {
      fields: options.search.fields,
      storeFields: [...storeFields],
    });
    const results = loaded.search("Need", { prefix: true, boost: { ...options.weights } });
    expect(results.map((result) => result.id)).toEqual(["/title", "/h1", "/h2"]);
  });

  it("excludes configured stop words from the serialized index", () => {
    const options = resolveOptions({
      sitemap: "https://example.com/sitemap.xml",
      output: "out",
      search: { stopWords: "en,the-site" },
    });
    const index = createIndex(
      [{ id: "/one", title: "The useful result", h1: "", ...blank }],
      options,
    );
    const serialized = JSON.stringify(index);
    const loaded = MiniSearch.loadJSON<SearchDocument>(serialized, {
      fields: options.search.fields,
      storeFields: [...storeFields],
      processTerm: createTermProcessor(options.search.stopWords),
    });

    expect(serialized).not.toContain('"the"');
    expect(options.search.stopWords).toContain("the-site");
    expect(loaded.search("useful")).toHaveLength(1);
    expect(loaded.search("the")).toHaveLength(0);
  });

  it("can index only selected fields", () => {
    const options = resolveOptions({
      sitemap: "https://example.com/sitemap.xml",
      output: "out",
      search: { fields: ["h1"] },
    });
    const index = createIndex(
      [
        { id: "/title-only", title: "Arcade", h1: "Different", ...blank },
        { id: "/h1", title: "Different", h1: "Arcade", ...blank },
      ],
      options,
    );
    const loaded = MiniSearch.loadJSON<SearchDocument>(JSON.stringify(index), {
      fields: options.search.fields,
      storeFields: [...storeFields],
    });

    expect(loaded.search("Arcade").map((result) => result.id)).toEqual(["/h1"]);
  });

  it("supports the Czech stop-word preset", () => {
    const options = resolveOptions({
      sitemap: "https://example.com/sitemap.xml",
      output: "out",
      search: { stopWords: "cs" },
    });
    expect(options.search.stopWords).toContain("pro");
    expect(options.search.stopWords).toContain("které");
    expect(options.search.stopWords).not.toContain("virtuální");
  });
});
