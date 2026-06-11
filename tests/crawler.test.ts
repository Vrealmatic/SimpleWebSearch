import { describe, expect, it, vi } from "vitest";
import { crawlPage } from "../src/crawler/crawl-page.js";
import { resolveOptions } from "../src/config.js";

const base = () =>
  resolveOptions({
    sitemap: "https://example.com/sitemap.xml",
    output: "out",
    crawler: { timeout: 20 },
  });

describe("page crawling", () => {
  it("reports HTTP errors with status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 503, statusText: "Unavailable" })),
    );
    await expect(crawlPage("https://example.com/x", base())).rejects.toMatchObject({
      message: "HTTP 503 Unavailable",
      status: 503,
    });
    vi.unstubAllGlobals();
  });

  it("aborts timed out requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
    await expect(crawlPage("https://example.com/slow", base())).rejects.toThrow(
      "timed out after 20ms",
    );
    vi.unstubAllGlobals();
  });

  it("uses relative IDs locally and absolute IDs for another origin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<title>External</title><h1>Page</h1>")),
    );
    const local = await crawlPage("https://example.com/x?q=1", base());
    const external = await crawlPage("https://other.test/x?q=1", base());
    expect(local.document?.id).toBe("/x?q=1");
    expect(external.document?.id).toBe("https://other.test/x?q=1");
    vi.unstubAllGlobals();
  });

  it("can retain absolute IDs for local pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<title>Local</title><h1>Page</h1>")),
    );
    const options = resolveOptions({
      sitemap: "https://example.com/sitemap.xml",
      output: "out",
      crawler: { absoluteIds: true },
    });
    const result = await crawlPage("https://example.com/x", options);
    expect(result.document?.id).toBe("https://example.com/x");
    vi.unstubAllGlobals();
  });
});
