export const DEFAULT_PAGE_SIZE: number;
export function pageCountFor(total: number, pageSize?: number): number;
export function clampPage(page: number, total: number, pageSize?: number): number;
export function paginateRows<T>(rows: T[], page: number, pageSize?: number): T[];
