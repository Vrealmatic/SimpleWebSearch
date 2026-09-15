export interface SearchDocument {
  id: string;
  title: string;
  h1: string;
  h2: string;
  h3: string;
  h4: string;
  h5: string;
  h6: string;
}

export interface SearchWeights {
  title: number;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
}

export type SearchField = keyof SearchWeights;
export type StopWordsInput = "en" | "cs" | string | string[];

export interface GeneratorOptions {
  sitemap: string;
  output: string;
  crawler?: {
    concurrency?: number;
    timeout?: number;
    includeSelector?: string;
    excludeSelector?: string | string[];
    sameOrigin?: boolean;
    useCanonical?: boolean;
    absoluteIds?: boolean;
    skipNoindex?: boolean;
    userAgent?: string;
    /** Keep only sitemap URLs whose xhtml:link alternate matches this hreflang (e.g. "cs"). */
    hreflang?: string;
    /**
     * Fetch the URLs found inside the sitemap from this origin instead of the one they name
     * (e.g. "http://localhost:3000"), keeping their path, query, and hash. Lets a local dev
     * server be indexed from a sitemap that already lists production URLs.
     */
    crawlOrigin?: string;
  };
  weights?: Partial<SearchWeights>;
  search?: {
    fields?: SearchField[];
    prefix?: boolean;
    fuzzy?: number | boolean;
    stopWords?: StopWordsInput;
  };
  baseUrl?: string;
  client?: boolean;
  pretty?: boolean;
  verbose?: boolean;
}

export interface ResolvedOptions {
  sitemap: string;
  output: string;
  crawler: {
    concurrency: number;
    timeout: number;
    includeSelector: string;
    excludeSelector: string;
    sameOrigin: boolean;
    useCanonical: boolean;
    absoluteIds: boolean;
    skipNoindex: boolean;
    userAgent: string;
    hreflang?: string;
    crawlOrigin?: string;
  };
  weights: SearchWeights;
  search: {
    fields: SearchField[];
    prefix: boolean;
    fuzzy: number | boolean;
    stopWords: string[];
  };
  baseUrl?: string;
  client: boolean;
  pretty: boolean;
  verbose: boolean;
}

export interface SearchFailure {
  url: string;
  status?: number;
  message: string;
}

export interface SearchReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  sitemapUrl: string;
  discoveredUrls: number;
  indexedUrls: number;
  skippedUrls: number;
  failedUrls: number;
  documentsWithoutTitle: string[];
  documentsWithoutH1: string[];
  duplicateCanonicalUrls: string[];
  failures: SearchFailure[];
}

export interface GenerateResult {
  documents: SearchDocument[];
  report: SearchReport;
  output: string;
}
