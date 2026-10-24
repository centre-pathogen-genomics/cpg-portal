import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  LoaderCircle,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type RunPublicMinimal,
  type RunStatus,
  RunsService,
  SettingsService,
} from "../../../client";
import {
  BulkDeleteMenu,
  type BulkDeleteMode,
} from "../../../components/Common/BulkDeleteMenu";
import DeleteAlert from "../../../components/Common/DeleteAlert";
import { PaginatedTableFooter } from "../../../components/Common/PaginatedTableFooter";
import ViewModeButtons from "../../../components/Common/ViewModeButtons";
import CancelAlert from "../../../components/Runs/CancelAlert";
import CancelRunsButton from "../../../components/Runs/CancelRunsButton";
import ParamTag from "../../../components/Runs/ParamTag";
import RunRuntime from "../../../components/Runs/RunTime";
import StatusBadge, { StatusIcon } from "../../../components/Runs/StatusBadge";
import useCustomToast from "../../../hooks/useCustomToast";
import useViewMode, { type ViewMode } from "../../../hooks/useViewMode";
import { useVisibleIds } from "../../../hooks/useVisibleIds";
import { humanReadableDate } from "../../../utils";

export const Route = createFileRoute("/_layout/runs/")({
  component: Runs,
  head: () => ({ meta: [{ title: "My Runs | CPG Portal" }] }),
});

interface RunsTableProps {
  nameFilter: string;
  orderBy: string;
  setOrderBy: React.Dispatch<React.SetStateAction<string>>;
  setVisibleRunIds: React.Dispatch<React.SetStateAction<string[]>>;
  toolFilter: string;
  view: ViewMode;
}

type SortColumn = "name" | "status" | "created_at" | "finished_at" | "runtime";

const inactiveRunStatuses: RunStatus[] = ["completed", "failed", "cancelled"];
const activeRunStatuses: RunStatus[] = ["pending", "running"];

const sortLabels: Record<SortColumn, string> = {
  name: "Name",
  status: "Status",
  created_at: "Date",
  finished_at: "Finished",
  runtime: "Runtime",
};

interface RunActionsMenuProps {
  run: RunPublicMinimal;
}

function RunActionsMenu({ run }: RunActionsMenuProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(run.name ?? "");
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const canCancel = ["running", "pending"].includes(run.status);
  const displayName = run.name ?? run.id.split("-")[0];

  const renameMutation = useMutation({
    mutationFn: (name: string) =>
      RunsService.renameRun({
        path: { id: run.id },
        query: { name },
      }),
    onSuccess: () => {
      showToast("Success", "Run renamed successfully.", "success");
      setRenameOpen(false);
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      queryClient.invalidateQueries({
        queryKey: [{ _id: "runsReadRun", path: { id: run.id } }],
      });
    },
    onError: () => {
      showToast(
        "An error occurred.",
        "An error occurred while renaming the run.",
        "error",
      );
    },
  });

  const showRename = () => {
    setRenameValue(displayName);
    setRenameOpen(true);
  };
  const rename = () => {
    const name = renameValue.trim();
    if (name && name !== displayName) {
      renameMutation.mutate(name);
    } else {
      setRenameOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Run actions">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(event) => event.stopPropagation()}
            onSelect={showRename}
          >
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          {canCancel ? (
            <DropdownMenuItem
              onClick={(event) => event.stopPropagation()}
              onSelect={() => setCancelOpen(true)}
            >
              <Ban className="size-4" />
              Cancel
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              onClick={(event) => event.stopPropagation()}
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Run</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && rename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={rename}
              disabled={!renameValue.trim() || renameMutation.isPending}
            >
              {renameMutation.isPending && (
                <LoaderCircle className="animate-spin" />
              )}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CancelAlert
        id={run.id}
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
      />
      <DeleteAlert
        type="Run"
        id={run.id}
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

/** A run's params, matching the table's params cell. */
function RunParamTags({ run }: { run: RunPublicMinimal }) {
  const keys = Object.keys(run.params).filter(
    (key) => run.params[key] !== null,
  );
  if (!keys.length) return null;

  return (
    <div className="pointer-events-none flex flex-wrap">
      {keys.map((key) => (
        <div key={key} className="m-0.5">
          <ParamTag param={key} value={run.params[key]} />
        </div>
      ))}
    </div>
  );
}

/** A run's tags, matching the table's tags cell. */
function RunTags({ run }: { run: RunPublicMinimal }) {
  if (!run.tags?.length) return null;

  return (
    <div className="pointer-events-none flex flex-wrap">
      {run.tags.map((tag) => (
        <Badge
          key={tag}
          className="mr-1 bg-cyan-100 text-cyan-800 hover:bg-cyan-100"
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
}

/** One run as a card, for the cards view. */
function RunCard({ run }: { run: RunPublicMinimal }) {
  const name = run.name ?? run.id.split("-")[0];
  const toolName = run.tool_version
    ? `${run.tool.name} (v${run.tool_version})`
    : run.tool.name;

  return (
    <Card className="relative gap-3 p-4 transition-colors hover:bg-muted/50">
      {/* The whole card opens the run, so the actions menu keeps its clicks. */}
      <Link
        to="/runs/$runid"
        params={{ runid: run.id }}
        aria-label={`Open ${name}`}
        className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <div className="flex items-start justify-between gap-2">
        {/* The status shows as a larger icon right of the name, and the label
            would take the room the details need. */}
        <div className="pointer-events-none flex min-w-0 items-start gap-2">
          <div className="min-w-0">
            <div className="truncate font-semibold">{name}</div>
            <div className="truncate text-sm text-muted-foreground">
              {toolName}
            </div>
          </div>
          <StatusIcon
            status={run.status}
            className="mt-0.5 ml-1 shrink-0 text-xl"
          />
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          <RunActionsMenu run={run} />
        </div>
      </div>
      <RunParamTags run={run} />
      <RunTags run={run} />
      <div className="pointer-events-none flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{humanReadableDate(run.created_at)}</span>
        <RunRuntime
          started_at={run.started_at ?? null}
          finished_at={run.finished_at ?? null}
          status={run.status}
        />
        <span>{run.cpus} threads</span>
      </div>
    </Card>
  );
}

/** One run as a compact line, for the list view. */
function RunListRow({ run }: { run: RunPublicMinimal }) {
  const name = run.name ?? run.id.split("-")[0];
  const toolName = run.tool_version
    ? `${run.tool.name} (v${run.tool_version})`
    : run.tool.name;

  return (
    <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border bg-card px-3 py-2 transition-colors hover:bg-muted/50">
      {/* The whole line opens the run, so the actions menu keeps its clicks. */}
      <Link
        to="/runs/$runid"
        params={{ runid: run.id }}
        aria-label={`Open ${name}`}
        className="absolute inset-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <span className="pointer-events-none flex shrink-0 items-center">
        <StatusIcon status={run.status} className="text-xl" />
      </span>
      <span className="pointer-events-none min-w-0 flex-1 truncate font-semibold">
        {name}
      </span>
      <span className="pointer-events-none shrink-0 text-sm text-muted-foreground">
        {toolName}
      </span>
      <RunParamTags run={run} />
      <RunTags run={run} />
      <span className="pointer-events-none shrink-0 text-sm text-muted-foreground">
        {humanReadableDate(run.created_at)}
      </span>
      <span className="pointer-events-none shrink-0 text-sm text-muted-foreground">
        <RunRuntime
          started_at={run.started_at ?? null}
          finished_at={run.finished_at ?? null}
          status={run.status}
        />
      </span>
      <span className="pointer-events-none shrink-0 text-sm text-muted-foreground">
        {run.cpus} threads
      </span>
      <div className="relative z-10 ml-auto flex shrink-0 items-center">
        <RunActionsMenu run={run} />
      </div>
    </div>
  );
}

/** Loading placeholder shaped like `RunCard`. */
function RunCardSkeleton() {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="size-8" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </Card>
  );
}

/** Loading placeholder shaped like `RunListRow`. */
function RunListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
      <Skeleton className="h-5 w-20 shrink-0" />
      <Skeleton className="h-5 flex-1" />
      <Skeleton className="hidden h-5 w-32 sm:block" />
      <Skeleton className="h-5 w-24 shrink-0" />
      <Skeleton className="size-8 shrink-0" />
    </div>
  );
}

function RunsTable({
  nameFilter,
  orderBy,
  setOrderBy,
  setVisibleRunIds,
  toolFilter,
  view,
}: RunsTableProps) {
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const navigate = useNavigate({ from: Route.fullPath });
  const trimmedNameFilter = nameFilter.trim();

  useEffect(() => {
    setPage(1);
  }, [trimmedNameFilter, orderBy, pageSize, toolFilter]);

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
  });

  const runs = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const isInactiveRun = useCallback(
    (run: RunPublicMinimal) => inactiveRunStatuses.includes(run.status),
    [],
  );
  useVisibleIds(runs, setVisibleRunIds, isInactiveRun);

  const sortRuns = (column: SortColumn) => {
    setOrderBy((current) => (current === column ? `-${column}` : column));
  };
  const changePage = (nextPage: number) => {
    setPage(Math.min(Math.max(nextPage, 1), pageCount));
  };
  const changePageSize = (nextPageSize: number) => {
    setPageSize(nextPageSize);
  };
  const renderSortableHeading = (column: SortColumn) => {
    const isAscending = orderBy === column;
    const isDescending = orderBy === `-${column}`;
    const Icon = isAscending ? ArrowUp : isDescending ? ArrowDown : ArrowUpDown;

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
    );
  };

  // The cards and list views show the same runs as the table, only laid out
  // differently, so they share its loading, error and empty states.
  if (view !== "table") {
    const Entry = view === "cards" ? RunCard : RunListRow;
    const listClassName =
      view === "cards"
        ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        : "flex flex-col gap-2";

    return (
      <>
        {isLoading ? (
          <div className={listClassName}>
            {new Array(pageSize)
              .fill(null)
              .map((_, index) =>
                view === "cards" ? (
                  <RunCardSkeleton key={index} />
                ) : (
                  <RunListRowSkeleton key={index} />
                ),
              )}
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Could not load runs</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        ) : runs.length ? (
          <div className={listClassName}>
            {runs.map((run) => (
              <Entry key={run.id} run={run} />
            ))}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-md border text-center">
            No runs found.
          </div>
        )}
        <PaginatedTableFooter
          isFetching={isFetching}
          isLoading={isLoading}
          itemLabel="runs"
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
        />
      </>
    );
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
              <TableHead>{renderSortableHeading("created_at")}</TableHead>
              <TableHead>{renderSortableHeading("runtime")}</TableHead>
              <TableHead>Threads</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              new Array(pageSize).fill(null).map((_, row) => (
                <TableRow key={row}>
                  {new Array(10).fill(null).map((_, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-5" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={10} className="text-destructive">
                  Error: {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : runs.length ? (
              runs.map((run) => (
                <TableRow
                  key={run.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={(event) => {
                    if (
                      (event.target as Element).closest(
                        "button, a, input, [data-run-actions-cell]",
                      )
                    )
                      return;
                    navigate({
                      to: "/runs/$runid",
                      params: { runid: run.id },
                      resetScroll: true,
                    });
                  }}
                >
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell>{run.name ?? run.id.split("-")[0]}</TableCell>
                  <TableCell>
                    {run.tool_version
                      ? `${run.tool.name} (v${run.tool_version})`
                      : run.tool.name}
                  </TableCell>
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
                  <TableCell>{humanReadableDate(run.created_at)}</TableCell>
                  <TableCell>
                    <RunRuntime
                      started_at={run.started_at ?? null}
                      finished_at={run.finished_at ?? null}
                      status={run.status}
                    />
                  </TableCell>
                  <TableCell>{run.cpus}</TableCell>
                  <TableCell
                    data-run-actions-cell
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex justify-center">
                      <RunActionsMenu run={run} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  No runs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <PaginatedTableFooter
        isFetching={isFetching}
        isLoading={isLoading}
        itemLabel="runs"
        onPageChange={changePage}
        onPageSizeChange={changePageSize}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
      />
    </>
  );
}

interface RunsActionsMenuProps {
  allCount: number;
  visibleRunIds: string[];
}

function RunsActionsMenu({ allCount, visibleRunIds }: RunsActionsMenuProps) {
  const [deleteMode, setDeleteMode] = useState<BulkDeleteMode | null>(null);
  const queryClient = useQueryClient();
  const showToast = useCustomToast();

  const mutation = useMutation({
    mutationFn: async (mode: BulkDeleteMode) => {
      await RunsService.deleteRuns({
        query:
          mode === "current"
            ? {
                ids: visibleRunIds,
              }
            : {},
      });
    },
    onSuccess: () => {
      showToast("Success", "Runs deleted successfully.", "success");
      setDeleteMode(null);
    },
    onError: () => {
      showToast("An error occurred.", "Failed to delete runs.", "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      queryClient.invalidateQueries({ queryKey: ["runs-count"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });

  return (
    <BulkDeleteMenu
      allCount={allCount}
      confirmLabel={deleteMode === "current" ? "Delete Visible" : "Delete All"}
      currentCount={visibleRunIds.length}
      descriptionNoun="inactive run"
      descriptionSuffix=" and associated unsaved files"
      mode={deleteMode}
      onConfirm={() => {
        if (deleteMode) mutation.mutate(deleteMode);
      }}
      onModeChange={setDeleteMode}
      pending={mutation.isPending}
      titleNoun="Runs"
      triggerAriaLabel="Run actions"
    />
  );
}

function Runs() {
  const [nameFilter, setNameFilter] = useState("");
  const [orderBy, setOrderBy] = useState("-created_at");
  const [toolFilter, setToolFilter] = useState("all");
  const [visibleRunIds, setVisibleRunIds] = useState<string[]>([]);
  const [view, setView] = useViewMode("records");
  const { data: toolNames } = useQuery({
    queryKey: ["runs", "tools"],
    queryFn: async () => (await RunsService.readRunToolNames()).data ?? [],
  });
  // Runs that are still going, which are the ones Cancel All can stop.
  const { data: activeRunsCount } = useQuery({
    queryKey: ["runs-count", "active"],
    queryFn: async () =>
      (
        await RunsService.readRuns({
          query: { skip: 0, limit: 1, statuses: activeRunStatuses },
        })
      ).data?.count ?? 0,
    refetchInterval: 10_000,
  });
  const { data: allRunsCount } = useQuery({
    queryKey: ["runs-count", "all"],
    queryFn: async () =>
      (
        await RunsService.readRuns({
          query: { skip: 0, limit: 1, statuses: inactiveRunStatuses },
        })
      ).data?.count ?? 0,
  });
  const { data: queueStatus } = useQuery({
    queryKey: ["settings", "queue"],
    queryFn: async () => (await SettingsService.readQueueDrainStatus()).data,
    refetchInterval: 15_000,
  });

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 xl:px-12">
      <div className="mb-2 space-y-1">
        <h1 className="pt-6 text-4xl font-bold">My Runs</h1>
        <p>Click on a run to view more details and results.</p>
      </div>
      {queueStatus?.queue_paused && (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-950">
          <TriangleAlert className="size-4" />
          <AlertTitle>Queue is draining</AlertTitle>
          <AlertDescription>
            New runs will stay pending until the queue is resumed.
            {queueStatus.queue_pause_reason && (
              <span className="mt-1 block">
                Reason: {queueStatus.queue_pause_reason}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}
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
          {!!activeRunsCount && <CancelRunsButton />}
          <ViewModeButtons mode={view} onChange={setView} />
          <RunsActionsMenu
            allCount={allRunsCount ?? 0}
            visibleRunIds={visibleRunIds}
          />
        </div>
      </div>
      <RunsTable
        nameFilter={nameFilter}
        orderBy={orderBy}
        setOrderBy={setOrderBy}
        setVisibleRunIds={setVisibleRunIds}
        toolFilter={toolFilter}
        view={view}
      />
    </div>
  );
}

export default Runs;
