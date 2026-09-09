export interface PaginationResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  firstVisible: number;
  lastVisible: number;
}

export function paginateItems<T>(
  items: readonly T[],
  requestedPage: number,
  requestedPageSize: number,
): PaginationResult<T> {
  const pageSize =
    Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0
      ? requestedPageSize
      : 10;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const normalizedPage =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const page = Math.min(normalizedPage, totalPages);
  const startIndex = (page - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page,
    pageSize,
    totalPages,
    firstVisible: items.length === 0 ? 0 : startIndex + 1,
    lastVisible: Math.min(startIndex + pageSize, items.length),
  };
}
