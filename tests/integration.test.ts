import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSearchIndex } from "../src/index.js";

afterEach(() => vi.unstubAllGlobals());

describe("generation", () => {
  it("continues after page failures and writes all output files", async () => {
    const output = join(await mkdtemp(join(tmpdir(), "heading-index-")), "search");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("sitemap.xml"))
          return new Response(
            `<urlset><url><loc>/ok</loc></url><url><loc>/bad</loc></url></urlset>`,
          );
        if (url.endsWith("/bad")) return new Response("bad", { status: 500 });
        return new Response(`<title>Good</title><main><h1>Page</h1></main>`);
      }),
    );
    const result = await generateSearchIndex({
      sitemap: "https://example.com/sitemap.xml",
      output,
      pretty: true,
      crawler: { includeSelector: "main" },
    });
    expect(result.report).toMatchObject({ discoveredUrls: 2, indexedUrls: 1, failedUrls: 1 });
    for (const name of [
      "search-index.json",
      "search-documents.json",
      "search-config.json",
      "search-report.json",
    ]) {
      expect(JSON.parse(await readFile(join(output, name), "utf8"))).toBeTruthy();
    }
  });
});
