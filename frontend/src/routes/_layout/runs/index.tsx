import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { LoaderCircle } from "lucide-react"
import { useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

function RunsTable() {
  const pageSize = 20
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  useEffect(
    () => () => queryClient.removeQueries({ queryKey: ["runs", pageSize] }),
    [queryClient],
  )
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["runs", pageSize],
    queryFn: async ({ pageParam = 1 }) =>
      (
        await RunsService.readRuns({
          query: { skip: (pageParam - 1) * pageSize, limit: pageSize },
          timeout: 10000,
        })
      ).data,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage?.data.length === pageSize ? pages.length + 1 : undefined,
    refetchInterval: 5000,
  })
  const runs = data?.pages.flatMap((page) => page?.data ?? []) || []
  return (
    <>
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Status",
                "Name",
                "Tool",
                "Params",
                "Tags",
                "Shared",
                "Date",
                "Runtime",
                "Actions",
              ].map((heading) => (
                <TableHead key={heading}>{heading}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                {new Array(9).fill(null).map((_, index) => (
                  <TableCell key={index}>
                    <Skeleton className="h-5" />
                  </TableCell>
                ))}
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={9} className="text-destructive">
                  Error: {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : (
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
                    {run.started_at ? humanReadableDate(run.started_at) : ""}
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
            )}
          </TableBody>
        </Table>
      </div>
      {hasNextPage && (
        <div className="flex justify-center py-4">
          <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage && <LoaderCircle className="animate-spin" />}
            Load more runs
          </Button>
        </div>
      )}
    </>
  )
}

function Runs() {
  return (
    <div className="w-full px-4 md:px-6 lg:px-8 xl:px-12">
      <div className="mb-2 space-y-1">
        <h1 className="pt-6 text-4xl font-bold">My Runs</h1>
        <p>Click on a run to view more details and results.</p>
      </div>
      <div className="mb-4 flex justify-end gap-4">
        <CancelRunsButton />
        <DeleteRunsButton />
      </div>
      <RunsTable />
    </div>
  )
}

export default Runs
