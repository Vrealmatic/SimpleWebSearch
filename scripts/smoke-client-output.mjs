import { stat } from "node:fs/promises";
import process from "node:process";
import { generateSearchIndex } from "../dist/index.js";

const { Response } = globalThis;

globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.endsWith("sitemap.xml")) {
    return new Response("<urlset><url><loc>https://example.com/a</loc></url></urlset>");
  }
  return new Response("<title>A</title><main><h1>Alpha</h1></main>");
};

await generateSearchIndex({
  sitemap: "https://example.com/sitemap.xml",
  output: "/tmp/heading-search-index-client-smoke",
  client: true,
  crawler: { includeSelector: "main" },
  search: { fields: ["h1"] },
});

const client = await stat("/tmp/heading-search-index-client-smoke/search-client.js");
if (client.size < 10_000) {
  throw new Error(`search-client.js is unexpectedly small: ${client.size} bytes`);
}

process.stdout.write(`search-client.js ${client.size} bytes\n`);
