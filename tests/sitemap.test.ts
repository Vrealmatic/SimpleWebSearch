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

  it("filters urlset entries by hreflang alternate and skips unannotated entries", () => {
    const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
      <url><loc>/</loc>
        <xhtml:link rel="alternate" hreflang="cs" href="/"/>
        <xhtml:link rel="alternate" hreflang="EN" href="/en"/>
        <xhtml:link rel="alternate" hreflang="x-default" href="/"/>
      </url>
      <url><loc>/en</loc>
        <xhtml:link rel="alternate" hreflang="cs" href="/"/>
        <xhtml:link rel="alternate" hreflang="EN" href="/en"/>
      </url>
      <url><loc>/no-alternates</loc></url>
    </urlset>`;
    const source = "https://example.com/sitemap.xml";
    expect(parseSitemap(xml, source, "en")).toEqual({
      type: "urlset",
      locations: ["https://example.com/en", "https://example.com/en"],
    });
    expect(parseSitemap(xml, source, "x-default")).toEqual({
      type: "urlset",
      locations: ["https://example.com/"],
    });
    // Without a filter, alternates are ignored and behavior is unchanged.
    expect(parseSitemap(xml, source).locations).toEqual([
      "https://example.com/",
      "https://example.com/en",
      "https://example.com/no-alternates",
    ]);
  });

  it("deduplicates hreflang-filtered URLs across a sitemap tree", async () => {
    const responses: Record<string, string> = {
      "https://example.com/root.xml": `<sitemapindex><sitemap><loc>/pages.xml</loc></sitemap></sitemapindex>`,
      "https://example.com/pages.xml": `<urlset>
        <url><loc>/a</loc><xhtml:link rel="alternate" hreflang="cs" href="/a"/><xhtml:link rel="alternate" hreflang="en" href="/en/a"/></url>
        <url><loc>/en/a</loc><xhtml:link rel="alternate" hreflang="cs" href="/a"/><xhtml:link rel="alternate" hreflang="en" href="/en/a"/></url>
      </urlset>`,
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
        hreflang: "cs",
      }),
    ).resolves.toEqual(["https://example.com/a"]);
    vi.unstubAllGlobals();
  });

  it("moves sitemap URLs onto crawlOrigin, including nested sitemaps", async () => {
    // A dev server renders its sitemap with production URLs; crawlOrigin points them back home.
    const responses: Record<string, string> = {
      "http://localhost:3000/sitemap.xml": `<sitemapindex><sitemap><loc>https://example.com/pages.xml</loc></sitemap></sitemapindex>`,
      "http://localhost:3000/pages.xml": `<urlset>
        <url><loc>https://example.com/a</loc><xhtml:link rel="alternate" hreflang="cs" href="https://example.com/a"/><xhtml:link rel="alternate" hreflang="sk" href="https://example.com/sk/a?x=1"/></url>
        <url><loc>https://example.com/b</loc><xhtml:link rel="alternate" hreflang="sk" href="https://example.com/sk/b"/></url>
      </urlset>`,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (input: string | URL | Request) =>
          new Response(responses[String(input)], { status: 200 }),
      ),
    );
    await expect(
      discoverUrls("http://localhost:3000/sitemap.xml", {
        timeout: 1000,
        userAgent: "test",
        sameOrigin: true,
        hreflang: "sk",
        crawlOrigin: "http://localhost:3000",
      }),
    ).resolves.toEqual(["http://localhost:3000/sk/a?x=1", "http://localhost:3000/sk/b"]);
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("rejects invalid sitemap XML", () => {
    expect(() => parseSitemap("<html></html>", "https://example.com/sitemap.xml")).toThrow(
      "expected urlset or sitemapindex",
    );
  });
});
