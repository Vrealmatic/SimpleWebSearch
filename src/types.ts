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
  };
  weights?: Partial<SearchWeights>;
  search?: {
    prefix?: boolean;
    fuzzy?: number | boolean;
    stopWords?: "en" | "cs" | string[];
  };
  baseUrl?: string;
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
  };
  weights: SearchWeights;
  search: { prefix: boolean; fuzzy: number | boolean; stopWords: string[] };
  baseUrl?: string;
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
