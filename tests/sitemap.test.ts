import { describe, expect, it, vi } from "vitest";
import { parseSitemap } from "../src/sitemap/parse-sitemap.js";
import { discoverUrls } from "../src/sitemap/fetch-sitemap.js";

describe("sitemaps", () => {
  it("parses urlsets with namespaces, relative URLs, and duplicates", () => {
    const result = parseSitemap(
      `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>/one</loc></url><url><loc>https://example.com/two</loc></url><url><loc>/one</loc></url>
    </urlset>`,
      "https://example.com/sitemap.xml",
    );
    expect(result).toEqual({
      type: "urlset",
      locations: ["https://example.com/one", "https://example.com/two", "https://example.com/one"],
    });
  });

  it("recursively follows sitemap indexes and avoids cycles", async () => {
    const responses: Record<string, string> = {
      "https://example.com/root.xml": `<sitemapindex><sitemap><loc>/child.xml</loc></sitemap></sitemapindex>`,
      "https://example.com/child.xml": `<sitemapindex><sitemap><loc>/root.xml</loc></sitemap><sitemap><loc>/pages.xml</loc></sitemap></sitemapindex>`,
      "https://example.com/pages.xml": `<urlset><url><loc>/b</loc></url><url><loc>/a</loc></url><url><loc>/a</loc></url><url><loc>https://other.test/x</loc></url></urlset>`,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (input: string | URL | Request) =>
          new Response(responses[String(input)], { status: 200 }),
      ),
    );
    await expect(
      discoverUrls("https://example.com/root.xml", {
        timeout: 1000,
        userAgent: "test",
        sameOrigin: true,
      }),
    ).resolves.toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(fetch).toHaveBeenCalledTimes(3);
    vi.unstubAllGlobals();
  });

  it("rejects invalid sitemap XML", () => {
    expect(() => parseSitemap("<html></html>", "https://example.com/sitemap.xml")).toThrow(
      "expected urlset or sitemapindex",
    );
  });
});
