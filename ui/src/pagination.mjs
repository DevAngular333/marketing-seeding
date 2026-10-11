export const DEFAULT_PAGE_SIZE = 10;

export function pageCountFor(total, pageSize = DEFAULT_PAGE_SIZE) {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

export function clampPage(page, total, pageSize = DEFAULT_PAGE_SIZE) {
  return Math.min(Math.max(1, page), pageCountFor(total, pageSize));
}

export function paginateRows(rows, page, pageSize = DEFAULT_PAGE_SIZE) {
  const currentPage = clampPage(page, rows.length, pageSize);
  const start = (currentPage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
