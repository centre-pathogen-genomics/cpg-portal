import { Button } from "@/components/ui/button"

type PaginationFooterProps = {
  hasNextPage?: boolean
  hasPreviousPage?: boolean
  onChangePage: (newPage: number) => void
  page: number
}

export function PaginationFooter({
  hasNextPage,
  hasPreviousPage,
  onChangePage,
  page,
}: PaginationFooterProps) {
  return (
    <div className="flex flex-row items-center justify-end gap-4">
      <Button
        onClick={() => onChangePage(page - 1)}
        disabled={!hasPreviousPage || page <= 1}
      >
        Previous
      </Button>
      <span>Page {page}</span>
      <Button disabled={!hasNextPage} onClick={() => onChangePage(page + 1)}>
        Next
      </Button>
    </div>
  )
}
