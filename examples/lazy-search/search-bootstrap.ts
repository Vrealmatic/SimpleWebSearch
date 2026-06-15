const searchArea = document.querySelector<HTMLElement>("[data-search]");
const input = searchArea?.querySelector<HTMLInputElement>("[data-search-input]");
const results = searchArea?.querySelector<HTMLElement>("[data-search-results]");
const baseUrl = searchArea?.dataset.searchBaseUrl;

if (searchArea && input && results) {
  let loading: Promise<void> | undefined;

  const activate = (): Promise<void> => {
    loading ??= import("heading-search-index/client")
      .then(({ attachSearch }) =>
        attachSearch({
          input,
          ...(baseUrl ? { baseUrl } : {}),
          onResults(items) {
            results.replaceChildren(
              ...items.map((item) => {
                const link = document.createElement("a");
                link.href = String(item.id);
                link.textContent = String(item.title);
                return link;
              }),
            );
          },
          onError(error) {
            console.error("Search could not be initialized", error);
          },
        }),
      )
      .then(() => undefined)
      .catch((error: unknown) => {
        console.error("Search could not be loaded", error);
      });
    return loading;
  };

  searchArea.addEventListener("pointerenter", activate, { once: true });
  input.addEventListener("focus", activate, { once: true });
}
