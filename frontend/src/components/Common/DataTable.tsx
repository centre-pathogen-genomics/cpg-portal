import {
  type SortingState,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { PaginatedTableFooter } from "@/components/Common/PaginatedTableFooter"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onVisibleDataChange?: (data: TData[]) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onVisibleDataChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 20,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  const pageCount = Math.max(table.getPageCount(), 1)
  const visibleData = useMemo(
    () => table.getRowModel().rows.map((row) => row.original),
    [table.getRowModel().rows],
  )

  useEffect(() => {
    onVisibleDataChange?.(visibleData)
  }, [onVisibleDataChange, visibleData])

  return (
    <>
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <Button
                          variant="ghost"
                          className="-ml-3 h-8 px-3"
                          onClick={header.column.getToggleSortingHandler()}
                          aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {header.column.getIsSorted() === "asc" ? (
                            <ArrowUp className="ml-2 h-4 w-4" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown className="ml-2 h-4 w-4" />
                          ) : (
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <PaginatedTableFooter
        itemLabel="users"
        onPageChange={(page) => table.setPageIndex(page - 1)}
        onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
        page={Math.min(table.getState().pagination.pageIndex + 1, pageCount)}
        pageSize={table.getState().pagination.pageSize}
        pageSizeOptions={[5, 10, 20, 50]}
        totalCount={data.length}
      />
    </>
  )
}
