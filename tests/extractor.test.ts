import { describe, expect, it } from "vitest";
import { extractHeadings } from "../src/extractor/extract-headings.js";

const options = {
  includeSelector: "main",
  excludeSelector: "nav, [data-search-ignore]",
  useCanonical: true,
  skipNoindex: true,
};

describe("heading extraction", () => {
  it("extracts, cleans, scopes, and deduplicates headings", () => {
    const result = extractHeadings(
      `<html><head><title>  A &amp; B </title></head><body>
      <h1>Outside</h1><main><nav><h2>Nav</h2></nav><h1>Hello <em>world</em></h1>
      <h2>Same</h2><h2> Same </h2><h3 data-search-ignore>Hidden</h3><h6>Last</h6></main></body></html>`,
      "https://example.com/path?q=1",
      options,
    );
    expect(result.document).toEqual({
      id: "https://example.com/path?q=1",
      title: "A & B",
      h1: "Hello world",
      h2: "Same",
      h3: "",
      h4: "",
      h5: "",
      h6: "Last",
    });
  });

  it("falls back from title to h1 and then pathname", () => {
    expect(
      extractHeadings(`<main><h1>Primary</h1></main>`, "https://example.com/x", options).document
        ?.title,
    ).toBe("Primary");
    const result = extractHeadings(`<main><p>None</p></main>`, "https://example.com/x", options);
    expect(result.document?.title).toBe("/x");
    expect(result.usedFallbackTitle).toBe(true);
    expect(result.missingH1).toBe(true);
  });

  it("uses canonical URLs and skips noindex", () => {
    const canonical = extractHeadings(
      `<head><link rel="canonical" href="/canonical"></head><main><h1>X</h1></main>`,
      "https://example.com/x",
      options,
    );
    expect(canonical.document?.id).toBe("https://example.com/canonical");
    const skipped = extractHeadings(
      `<meta name="robots" content="follow, noindex"><main><h1>X</h1></main>`,
      "https://example.com/x",
      options,
    );
    expect(skipped.skipped).toBe("noindex");
  });
});
