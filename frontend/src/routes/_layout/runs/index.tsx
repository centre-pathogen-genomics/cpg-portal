import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  LoaderCircle,
  Search,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RunsService } from "../../../client"
import CancelRunButton from "../../../components/Runs/CancelRunButton"
import CancelRunsButton from "../../../components/Runs/CancelRunsButton"
import DeleteRunButton from "../../../components/Runs/DeleteRunButton"
import DeleteRunsButton from "../../../components/Runs/DeleteRunsButton"
import ParamTag from "../../../components/Runs/ParamTag"
import RunRuntime from "../../../components/Runs/RunTime"
import StatusBadge from "../../../components/Runs/StatusBadge"
import { humanReadableDate } from "../../../utils"

export const Route = createFileRoute("/_layout/runs/")({
  component: Runs,
  head: () => ({ meta: [{ title: "My Runs | CPG Portal" }] }),
})

interface RunsTableProps {
  nameFilter: string
  orderBy: string
  setOrderBy: React.Dispatch<React.SetStateAction<string>>
  toolFilter: string
}

type SortColumn = "name" | "status" | "created_at" | "finished_at" | "runtime"

const sortLabels: Record<SortColumn, string> = {
  name: "Name",
  status: "Status",
  created_at: "Date",
  finished_at: "Finished",
  runtime: "Runtime",
}

function RunsTable({
  nameFilter,
  orderBy,
  setOrderBy,
  toolFilter,
}: RunsTableProps) {
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const navigate = useNavigate({ from: Route.fullPath })
  const trimmedNameFilter = nameFilter.trim()

  useEffect(() => {
    setPage(1)
  }, [trimmedNameFilter, orderBy, pageSize, toolFilter])

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["runs", pageSize, page, trimmedNameFilter, orderBy, toolFilter],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await RunsService.readRuns({
          query: {
            skip: (page - 1) * pageSize,
            limit: pageSize,
            ...(trimmedNameFilter ? { name: trimmedNameFilter } : {}),
            ...(toolFilter !== "all" ? { tool_name: toolFilter } : {}),
            order_by: orderBy,
          },
          timeout: 10000,
        })
      ).data,
    refetchInterval: 5000,
  })

  const runs = data?.data ?? []
  const totalCount = data?.count ?? 0
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

  const sortRuns = (column: SortColumn) => {
    setOrderBy((current) => (current === column ? `-${column}` : column))
  }
  const changePage = (nextPage: number) => {
    setPage(Math.min(Math.max(nextPage, 1), pageCount))
  }
  const changePageSize = (nextPageSize: number) => {
    setPageSize(nextPageSize)
  }
  const renderSortableHeading = (column: SortColumn) => {
    const isAscending = orderBy === column
    const isDescending = orderBy === `-${column}`
    const Icon = isAscending ? ArrowUp : isDescending ? ArrowDown : ArrowUpDown

    return (
      <Button
        variant="ghost"
        className="-ml-3 h-8 px-3"
        onClick={() => sortRuns(column)}
        aria-label={`Sort runs by ${sortLabels[column]}`}
      >
        {sortLabels[column]}
        <Icon className="ml-2 h-4 w-4" />
      </Button>
    )
  }

  return (
    <>
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{renderSortableHeading("status")}</TableHead>
              <TableHead>{renderSortableHeading("name")}</TableHead>
              <TableHead>Tool</TableHead>
              <TableHead>Params</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Shared</TableHead>
              <TableHead>{renderSortableHeading("created_at")}</TableHead>
              <TableHead>{renderSortableHeading("runtime")}</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              new Array(pageSize).fill(null).map((_, row) => (
                <TableRow key={row}>
                  {new Array(9).fill(null).map((_, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-5" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={9} className="text-destructive">
                  Error: {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : runs.length ? (
              runs.map((run) => (
                <TableRow
                  key={run.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={(event) => {
                    if ((event.target as Element).closest("button, a, input"))
                      return
                    navigate({
                      to: "/runs/$runid",
                      params: { runid: run.id },
                      resetScroll: true,
                    })
                  }}
                >
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell>{run.name ?? run.id.split("-")[0]}</TableCell>
                  <TableCell>{run.tool.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap">
                      {Object.keys(run.params)
                        .filter((key) => run.params[key] !== null)
                        .map((key) => (
                          <div key={key} className="m-0.5">
                            <ParamTag param={key} value={run.params[key]} />
                          </div>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {run.tags?.map((tag) => (
                      <Badge
                        key={tag}
                        className="mr-1 bg-cyan-100 text-cyan-800 hover:bg-cyan-100"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={run.shared ? "default" : "secondary"}
                      className={run.shared ? "bg-green-500" : undefined}
                    >
                      {run.shared ? "TRUE" : "FALSE"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {humanReadableDate(run.created_at)}
                  </TableCell>
                  <TableCell>
                    <RunRuntime
                      started_at={run.started_at ?? null}
                      finished_at={run.finished_at ?? null}
                      status={run.status}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      {["running", "pending"].includes(run.status) ? (
                        <CancelRunButton run_id={run.id} />
                      ) : (
                        <DeleteRunButton run_id={run.id} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  No runs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="text-sm text-muted-foreground">
            Showing {firstItem} to {lastItem} of {totalCount} runs
            {isFetching && !isLoading && (
              <LoaderCircle className="ml-2 inline h-4 w-4 animate-spin" />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Rows per page
            <select
              className="h-8 rounded-md border bg-background px-2 text-foreground"
              value={pageSize}
              onChange={(event) => changePageSize(Number(event.target.value))}
            >
              {[10, 20, 50, 100].map((size) => (
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
            onClick={() => changePage(page - 1)}
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
                onClick={() => changePage(pageNumber)}
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
            onClick={() => changePage(page + 1)}
            disabled={!hasNextPage}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  )
}

function Runs() {
  const [nameFilter, setNameFilter] = useState("")
  const [orderBy, setOrderBy] = useState("-created_at")
  const [toolFilter, setToolFilter] = useState("all")
  const { data: toolNames } = useQuery({
    queryKey: ["runs", "tools"],
    queryFn: async () => (await RunsService.readRunToolNames()).data ?? [],
  })

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 xl:px-12">
      <div className="mb-2 space-y-1">
        <h1 className="pt-6 text-4xl font-bold">My Runs</h1>
        <p>Click on a run to view more details and results.</p>
      </div>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="Search by name"
              aria-label="Search runs by name"
            />
          </div>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 sm:w-[180px]"
            value={toolFilter}
            onChange={(event) => setToolFilter(event.target.value)}
          >
            <option value="all">Tools</option>
            {toolNames?.map((toolName) => (
              <option key={toolName} value={toolName}>
                {toolName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-4">
          <CancelRunsButton />
          <DeleteRunsButton />
        </div>
      </div>
      <RunsTable
        nameFilter={nameFilter}
        orderBy={orderBy}
        setOrderBy={setOrderBy}
        toolFilter={toolFilter}
      />
    </div>
  )
}

export default Runs
