import type { PagedEnvelope } from "../api/types";

export async function loadAllPages<T>(
  load: (page: number) => Promise<PagedEnvelope<T>>,
  signal: AbortSignal,
): Promise<T[]> {
  const first = await load(1);
  const items = [...first.data];
  for (let page = 2; page <= first.meta.totalPages; page += 1) {
    if (signal.aborted) throw new DOMException("Request aborted", "AbortError");
    const next = await load(page);
    items.push(...next.data);
  }
  return items;
}
