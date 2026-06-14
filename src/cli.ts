#!/usr/bin/env node
import { Command, Option } from "commander";
import { generateSearchIndex } from "./index.js";
import { loadConfig, mergeOptions } from "./config.js";
import type { GeneratorOptions, SearchField } from "./types.js";

const program = new Command()
  .name("heading-search-index")
  .description("Generate a MiniSearch index from headings discovered through a sitemap")
  .option("--sitemap <url>")
  .option("--output <directory>")
  .option("--include-selector <selector>")
  .option("--exclude-selector <selector>")
  .option("--fields <fields>", "comma-separated fields to index, for example: h1 or title,h1")
  .addOption(new Option("--concurrency <number>").argParser(Number))
  .addOption(new Option("--timeout <milliseconds>").argParser(Number))
  .option("--base-url <url>")
  .option("--user-agent <value>")
  .option("--stop-words <words>", "preset or comma-separated words, for example: en,free,games")
  .option("--config <path>")
  .option("--client", "also write a browser ESM bundle as search-client.js")
  .option("--pretty")
  .option("--verbose");

program.parse();
const flags = program.opts();

async function main(): Promise<void> {
  const configured = flags.config ? await loadConfig(flags.config) : {};
  const cli: Partial<GeneratorOptions> = {
    ...(flags.sitemap ? { sitemap: flags.sitemap } : {}),
    ...(flags.output ? { output: flags.output } : {}),
    ...(flags.baseUrl ? { baseUrl: flags.baseUrl } : {}),
    ...(flags.client ? { client: true } : {}),
    ...(flags.pretty ? { pretty: true } : {}),
    ...(flags.verbose ? { verbose: true } : {}),
    crawler: {
      ...(flags.includeSelector ? { includeSelector: flags.includeSelector } : {}),
      ...(flags.excludeSelector ? { excludeSelector: flags.excludeSelector } : {}),
      ...(flags.concurrency !== undefined ? { concurrency: flags.concurrency } : {}),
      ...(flags.timeout !== undefined ? { timeout: flags.timeout } : {}),
      ...(flags.userAgent ? { userAgent: flags.userAgent } : {}),
    },
    ...(flags.fields || flags.stopWords
      ? {
          search: {
            ...(flags.fields ? { fields: parseFields(flags.fields) } : {}),
            ...(flags.stopWords ? { stopWords: flags.stopWords } : {}),
          },
        }
      : {}),
  };
  const options = mergeOptions(configured, cli);
  if (!options.sitemap || !options.output)
    throw new Error("--sitemap and --output are required unless provided by --config");
  if ((options.crawler?.concurrency ?? 5) < 1) throw new Error("--concurrency must be at least 1");
  const result = await generateSearchIndex(options);
  console.log(
    `Indexed ${result.report.indexedUrls}/${result.report.discoveredUrls} pages into ${result.output}`,
  );
}

function parseFields(value: string): SearchField[] {
  return value
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean) as SearchField[];
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
