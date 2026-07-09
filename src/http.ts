export interface FetchedResource {
  ok: boolean;
  status: number;
  statusText: string;
  contentType: string;
  body: Buffer;
}

/** Fetch a URL with a hard timeout, returning status metadata and the raw body. */
export async function fetchResource(
  url: string,
  options: { timeout: number; userAgent: string; accept?: string },
): Promise<FetchedResource> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": options.userAgent,
        ...(options.accept ? { accept: options.accept } : {}),
      },
      signal: AbortSignal.timeout(options.timeout),
    });
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type") ?? "",
      body: Buffer.from(await response.arrayBuffer()),
    };
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error(`Request timed out after ${options.timeout}ms`);
    }
    throw error;
  }
}
