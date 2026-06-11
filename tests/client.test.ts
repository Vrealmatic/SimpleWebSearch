import MiniSearch from "minisearch";
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachSearch } from "../src/client.js";

class TestInput extends EventTarget {
  value = "";
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("browser search client", () => {
  it("loads the generated files and attaches debounced prefix search", async () => {
    vi.useFakeTimers();
    const index = new MiniSearch({ fields: ["title"], storeFields: ["title"] });
    index.addAll([
      { id: "/alpha", title: "Alpha page" },
      { id: "/beta", title: "Beta page" },
    ]);
    const config = {
      fields: ["title"],
      storeFields: ["title"],
      searchOptions: { boost: { title: 12 }, prefix: true, fuzzy: 0.2, stopWords: [] },
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(index)))
        .mockResolvedValueOnce(Response.json(config)),
    );
    const input = new TestInput();
    const onResults = vi.fn();
    const detach = await attachSearch({
      input: input as unknown as HTMLInputElement,
      debounceMs: 20,
      onResults,
    });

    input.value = "Alp";
    input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(20);

    expect(onResults).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "/alpha", title: "Alpha page" })],
      "Alp",
    );
    detach();
  });

  it("rejects an unavailable index", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(Response.json({})),
    );
    await expect(
      attachSearch({
        input: new TestInput() as unknown as HTMLInputElement,
        onResults: vi.fn(),
      }),
    ).rejects.toThrow("Unable to load search index: HTTP 404");
  });
});
