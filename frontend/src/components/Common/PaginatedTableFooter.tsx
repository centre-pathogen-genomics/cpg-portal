import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PaginatedTableFooterProps {
  isFetching?: boolean
  isLoading?: boolean
  itemLabel: string
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  page: number
  pageSize: number
  pageSizeOptions?: number[]
  totalCount: number
}

export function PaginatedTableFooter({
  isFetching = false,
  isLoading = false,
  itemLabel,
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  totalCount,
}: PaginatedTableFooterProps) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasPreviousPage = page > 1
  const hasNextPage = page < pageCount
  const firstItem = totalCount ? (page - 1) * pageSize + 1 : 0
  const lastItem = Math.min(page * pageSize, totalCount)
  const firstVisiblePage = Math.min(
    Math.max(page - 2, 1),
    Math.max(pageCount - 4, 1),
  )
  const visiblePages = Array.from(
    { length: Math.min(5, pageCount) },
    (_, index) => firstVisiblePage + index,
  )

  return (
    <div className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="text-sm text-muted-foreground">
          Showing {firstItem} to {lastItem} of {totalCount} {itemLabel}
          {isFetching && !isLoading && (
            <LoaderCircle className="ml-2 inline h-4 w-4 animate-spin" />
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Rows per page
          <select
            className="h-8 rounded-md border bg-background px-2 text-foreground"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPreviousPage}
        >
          Previous
        </Button>
        <div className="flex items-center gap-1">
          {visiblePages.map((pageNumber) => (
            <Button
              key={pageNumber}
              variant={pageNumber === page ? "outline" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange(pageNumber)}
              aria-label={`Go to page ${pageNumber}`}
              aria-current={pageNumber === page ? "page" : undefined}
            >
              {pageNumber}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
