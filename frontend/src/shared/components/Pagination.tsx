interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, totalItems, pageSize, onPageChange }: PaginationProps) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="pagination">
      <span className="pagination-summary">
        Showing {start}–{end} of {totalItems}
      </span>
      <div className="pagination-controls">
        <button type="button" className="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <span className="pagination-page">
          Page {page} of {totalPages}
        </span>
        <button type="button" className="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
