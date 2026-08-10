import { useEffect, useMemo, useState } from "react";

export interface UsePaginationResult<T> {
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  totalItems: number;
  pageItems: T[];
}

export function usePagination<T>(items: T[], pageSize = 10): UsePaginationResult<T> {
  const [page, setPage] = useState(1);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { page, setPage, totalPages, totalItems, pageItems };
}
