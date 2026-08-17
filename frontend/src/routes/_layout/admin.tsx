import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Activity,
  Bot,
  CalendarDays,
  Database,
  Eye,
  type LucideIcon,
  LoaderCircle,
  MoreVertical,
  Pause,
  Play,
  Save,
  Search,
  Trash2,
  Users,
  Wrench,
} from "lucide-react"
import { Suspense, useEffect, useMemo, useState } from "react"

import {
  type SystemStats,
  type ToolDetailStats,
  type ToolMinimalPublic,
  type UserDetailStats,
  type UserPublic,
  UsersService,
} from "@/client"
import {
  getToolDetailStatsOptions,
  getSystemStatsOptions,
  getUserDetailStatsOptions,
  getSystemStatsQueryKey,
  pauseQueueMutation,
  readAppSettingsOptions,
  readAppSettingsQueryKey,
  readQueueStatusOptions,
  readQueueStatusQueryKey,
  readToolsOptions,
  readUsersOptions,
  readUsersQueryKey,
  resumeQueueMutation,
  updateAppSettingsMutation,
} from "@/client/@tanstack/react-query.gen"
import AddUser from "@/components/Admin/AddUser"
import CreateTool from "@/components/Admin/CreateTool"
import { columns, type UserTableData } from "@/components/Admin/columns"
import { ConfirmationDialog } from "@/components/Common/ConfirmationDialog"
import { DataTable } from "@/components/Common/DataTable"
import PendingUsers from "@/components/Pending/PendingUsers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"

function getUsersQueryOptions() {
  return readUsersOptions({ query: { skip: 0, limit: 1000 } })
}

export const Route = createFileRoute("/_layout/admin")({
  component: AdminDashboard,
  beforeLoad: async () => {
    const response = await UsersService.readUserMe({ throwOnError: true })
    if (!response.data.is_superuser) {
      throw redirect({ to: "/" })
    }
  },
  head: () => ({
    meta: [{ title: "Admin Dashboard | CPG Portal" }],
  }),
})

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: LucideIcon
  iconClassName: string
}) {
  return (
    <Card className="gap-0 rounded border-border py-0 shadow-sm">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Icon className={`size-8 ${iconClassName}`} strokeWidth={2} />
      </CardContent>
    </Card>
  )
}

function ProgressRow({
  label,
  count,
  total,
  colorClassName,
}: {
  label: string
  count: number
  total: number
  colorClassName: string
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-4 text-sm">
        <span>{label}</span>
        <span className="font-semibold">
          {count.toLocaleString()} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden bg-muted">
        <div
          className={`h-full ${colorClassName}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function StatValue({
  label,
  value,
  help,
}: {
  label: string
  value: string | number
  help?: string
}) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {help && <p className="mt-1 text-sm text-muted-foreground">{help}</p>}
    </div>
  )
}

function StatsPanel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className="gap-0 rounded border-border py-0 shadow-sm">
      <CardHeader className="p-5 pb-4">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">{children}</CardContent>
    </Card>
  )
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 Bytes"
  const units = ["Bytes", "KB", "MB", "GB", "TB"]
  const unit = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  return `${(bytes / 1024 ** unit).toFixed(2)} ${units[unit]}`
}

type DrilldownSelection =
  | { type: "user"; id: string; label: string }
  | { type: "tool"; id: string; label: string }

type QuickDateFilter = "today" | "7d" | "30d" | "90d" | "all" | "custom"
type UserStatusFilter = "all" | "active" | "inactive"

const quickDateFilters: Array<{
  label: string
  value: QuickDateFilter
}> = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "All", value: "all" },
]

function buildStatsQuery(startDate: string, endDate: string) {
  const query: { start?: string; end?: string } = {}
  if (startDate) query.start = startDate
  if (endDate) query.end = endDate
  return Object.keys(query).length ? query : undefined
}

function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0")
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/A"
  return new Date(value).toLocaleString()
}

function UsersTableContent({
  onSelectUser,
}: {
  onSelectUser: (user: UserPublic) => void
}) {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all")
  const [deleteVisibleOpen, setDeleteVisibleOpen] = useState(false)
  const { data: users } = useSuspenseQuery(getUsersQueryOptions())
  const tableData: UserTableData[] = useMemo(
    () =>
      users.data.map((user: UserPublic) => ({
        ...user,
        isCurrentUser: currentUser?.id === user.id,
      })),
    [currentUser?.id, users.data],
  )
  const filteredTableData = useMemo(() => {
    const query = search.trim().toLowerCase()
    return tableData.filter((user) => {
      if (statusFilter === "active" && !user.is_active) return false
      if (statusFilter === "inactive" && user.is_active) return false
      if (!query) return true
      const role = user.is_superuser ? "superuser" : "user"
      const status = user.is_active ? "active" : "inactive"
      return [
        user.full_name ?? "",
        user.email,
        role,
        status,
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [search, statusFilter, tableData])
  const deletableVisibleUsers = filteredTableData.filter(
    (user) => user.id !== currentUser?.id,
  )
  const bulkDeleteMutation = useMutation({
    mutationFn: async (usersToDelete: UserTableData[]) => {
      await Promise.all(
        usersToDelete.map((user) =>
          UsersService.deleteUser({
            path: { user_id: user.id },
            throwOnError: true,
          }),
        ),
      )
    },
    onSuccess: (_, usersToDelete) => {
      showToast(
        "Success",
        `Deleted ${usersToDelete.length} user${
          usersToDelete.length === 1 ? "" : "s"
        }.`,
        "success",
      )
      setDeleteVisibleOpen(false)
      queryClient.invalidateQueries({ queryKey: readUsersQueryKey() })
      queryClient.invalidateQueries({ queryKey: getSystemStatsQueryKey() })
    },
    onError: () => {
      showToast("Error", "Failed to delete visible users.", "error")
    },
  })
  const deleteVisibleUsers = () => {
    bulkDeleteMutation.mutate(deletableVisibleUsers)
  }
  const tableColumns = useMemo<ColumnDef<UserTableData>[]>(
    () => [
      ...columns,
      {
        id: "stats",
        enableSorting: false,
        header: () => <span className="sr-only">Stats</span>,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelectUser(row.original)}
          >
            <Eye />
            Stats
          </Button>
        ),
      },
    ],
    [onSelectUser],
  )
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users"
              aria-label="Search users"
            />
          </div>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 sm:w-[180px]"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as UserStatusFilter)
            }
            aria-label="Filter users by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex items-center gap-3 sm:justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="User bulk actions"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                disabled={deletableVisibleUsers.length === 0}
                onSelect={() => setDeleteVisibleOpen(true)}
              >
                <Trash2 />
                Delete Visible ({deletableVisibleUsers.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ConfirmationDialog
        open={deleteVisibleOpen}
        onOpenChange={setDeleteVisibleOpen}
        title="Delete Visible Users"
        description={`Are you sure you want to delete ${
          deletableVisibleUsers.length
        } visible user${deletableVisibleUsers.length === 1 ? "" : "s"} and all associated items? This action cannot be undone.`}
        confirmLabel="Delete Visible"
        pending={bulkDeleteMutation.isPending}
        onConfirm={deleteVisibleUsers}
      />
      <DataTable columns={tableColumns} data={filteredTableData} />
    </>
  )
}

function UsersTable({
  onSelectUser,
}: {
  onSelectUser: (user: UserPublic) => void
}) {
  return (
    <Suspense fallback={<PendingUsers />}>
      <UsersTableContent onSelectUser={onSelectUser} />
    </Suspense>
  )
}

function QueueControls() {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [reason, setReason] = useState("")
  const { data, isLoading } = useQuery({
    ...readQueueStatusOptions(),
    refetchInterval: 15_000,
  })

  const pauseMutation = useMutation({
    ...pauseQueueMutation(),
    onSuccess: () => {
      setReason("")
      queryClient.invalidateQueries({ queryKey: readQueueStatusQueryKey() })
      showToast("Success", "Queue drain started.", "success")
    },
    onError: () => {
      showToast("Error", "Failed to drain the queue.", "error")
    },
  })
  const resumeMutation = useMutation({
    ...resumeQueueMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readQueueStatusQueryKey() })
      showToast("Success", "Queue resumed.", "success")
    },
    onError: () => {
      showToast("Error", "Failed to resume the queue.", "error")
    },
  })

  const isBusy = pauseMutation.isPending || resumeMutation.isPending
  const statusLabel = data?.queue_paused
    ? data.running_runs > 0
      ? "Draining"
      : "Paused"
    : "Accepting"

  return (
    <StatsPanel title="Queue Controls">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Queue state</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge
                className={
                  data?.queue_paused
                    ? "rounded bg-amber-100 text-amber-800 hover:bg-amber-100"
                    : "rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                }
              >
                {isLoading ? "Loading" : statusLabel}
              </Badge>
              {data?.queue_paused_at && (
                <span className="text-sm text-muted-foreground">
                  since {formatDateTime(data.queue_paused_at)}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-right">
            <StatValue label="Pending" value={data?.pending_runs ?? 0} />
            <StatValue label="Running" value={data?.running_runs ?? 0} />
          </div>
        </div>
        {data?.queue_pause_reason && (
          <p className="text-sm text-muted-foreground">
            {data.queue_pause_reason}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Drain reason"
            disabled={data?.queue_paused || isBusy}
          />
          {data?.queue_paused ? (
            <Button
              type="button"
              onClick={() => resumeMutation.mutate(undefined)}
              disabled={isBusy}
            >
              {resumeMutation.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Play />
              )}
              Resume
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                pauseMutation.mutate({
                  body: { reason: reason.trim() || null },
                })
              }
              disabled={isBusy}
            >
              {pauseMutation.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Pause />
              )}
              Drain
            </Button>
          )}
        </div>
      </div>
    </StatsPanel>
  )
}

function DetailRunList({
  runs,
}: {
  runs: UserDetailStats["recent_runs"] | ToolDetailStats["recent_runs"]
}) {
  return (
    <div className="space-y-2">
      {runs.map((run) => (
        <div
          key={run.id}
          className="flex items-start justify-between gap-3 border-b py-2 text-sm last:border-b-0"
        >
          <div>
            <p className="font-medium">{run.name || run.tool_name}</p>
            <p className="text-muted-foreground">
              {run.tool_name} · {run.owner_email}
            </p>
          </div>
          <Badge variant="secondary" className="rounded">
            {run.status}
          </Badge>
        </div>
      ))}
      {runs.length === 0 && (
        <p className="text-sm text-muted-foreground">No runs in this range.</p>
      )}
    </div>
  )
}

function DetailPanel({
  selection,
  startDate,
  endDate,
}: {
  selection: DrilldownSelection | null
  startDate: string
  endDate: string
}) {
  const statsQuery = buildStatsQuery(startDate, endDate)
  const userDetail = useQuery({
    ...getUserDetailStatsOptions({
      path: { user_id: selection?.id ?? "" },
      query: statsQuery,
    }),
    enabled: selection?.type === "user",
  })
  const toolDetail = useQuery({
    ...getToolDetailStatsOptions({
      path: { tool_id: selection?.id ?? "" },
      query: statsQuery,
    }),
    enabled: selection?.type === "tool",
  })

  const isLoading = userDetail.isLoading || toolDetail.isLoading
  const userData = userDetail.data
  const toolData = toolDetail.data

  if (!selection) return null
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading stats
      </div>
    )
  }

  if (userData) {
    return (
      <div className="space-y-6 px-4 pb-6">
        <div className="grid grid-cols-2 gap-4">
          <StatValue label="Runs" value={userData.runs.total} />
          <StatValue
            label="Success"
            value={`${userData.runs.success_rate_percent.toFixed(1)}%`}
          />
          <StatValue label="Files" value={userData.files.total} />
          <StatValue
            label="Storage"
            value={formatBytes(userData.files.total_size_bytes)}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Top Tools</h3>
          <div className="mt-3 space-y-2">
            {userData.top_tools.map((tool) => (
              <div
                key={tool.name}
                className="flex justify-between gap-3 text-sm"
              >
                <span>{tool.name}</span>
                <Badge variant="secondary" className="rounded">
                  {tool.count}
                </Badge>
              </div>
            ))}
            {userData.top_tools.length === 0 && (
              <p className="text-sm text-muted-foreground">No tool usage.</p>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Recent Runs</h3>
          <div className="mt-3">
            <DetailRunList runs={userData.recent_runs} />
          </div>
        </div>
      </div>
    )
  }

  if (toolData) {
    return (
      <div className="space-y-6 px-4 pb-6">
        <div className="grid grid-cols-2 gap-4">
          <StatValue label="Runs" value={toolData.runs.total} />
          <StatValue
            label="Success"
            value={`${toolData.runs.success_rate_percent.toFixed(1)}%`}
          />
          <StatValue
            label="Average Runtime"
            value={`${toolData.runs.average_runtime_minutes.toFixed(1)} min`}
          />
          <StatValue
            label="Running"
            value={toolData.runs.currently_running}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Top Users</h3>
          <div className="mt-3 space-y-2">
            {toolData.top_users.map((user) => (
              <div
                key={user.id}
                className="flex justify-between gap-3 text-sm"
              >
                <span>{user.full_name || user.email}</span>
                <Badge variant="secondary" className="rounded">
                  {user.count}
                </Badge>
              </div>
            ))}
            {toolData.top_users.length === 0 && (
              <p className="text-sm text-muted-foreground">No users.</p>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Recent Runs</h3>
          <div className="mt-3">
            <DetailRunList runs={toolData.recent_runs} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <p className="px-4 text-sm text-destructive">Failed to load details.</p>
  )
}

function LlmSettingsPanel() {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [model, setModel] = useState("")
  const { data, isLoading, isError } = useQuery(readAppSettingsOptions())
  const savedModel = data?.llm_model ?? ""

  useEffect(() => {
    setModel(savedModel)
  }, [savedModel])

  const mutation = useMutation({
    ...updateAppSettingsMutation(),
    onSuccess: (updatedSettings) => {
      setModel(updatedSettings.llm_model ?? "")
      queryClient.invalidateQueries({ queryKey: readAppSettingsQueryKey() })
      showToast("Success", "LLM model updated.", "success")
    },
    onError: () => {
      showToast("Error", "Failed to update the LLM model.", "error")
    },
  })

  const trimmedModel = model.trim()
  const canSave =
    trimmedModel.length > 0 &&
    trimmedModel !== savedModel &&
    !mutation.isPending

  return (
    <StatsPanel title="LLM Settings">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canSave) return
          mutation.mutate({ body: { llm_model: trimmedModel } })
        }}
      >
        <div className="flex items-start gap-3">
          <Bot className="mt-1 size-6 text-indigo-500" />
          <div>
            <p className="text-sm font-medium">Summary model</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Used when generating AI summaries for completed runs.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="llm-model">Model name</Label>
          <Input
            id="llm-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            disabled={isLoading || mutation.isPending}
            placeholder="gemini-2.5-flash"
          />
          {isError && (
            <p className="text-sm text-destructive">
              Failed to load LLM settings.
            </p>
          )}
        </div>
        <Button type="submit" disabled={!canSave}>
          <Save />
          Save Model
        </Button>
      </form>
    </StatsPanel>
  )
}

function AdminDashboard() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [quickDateFilter, setQuickDateFilter] =
    useState<QuickDateFilter>("all")
  const [selection, setSelection] = useState<DrilldownSelection | null>(null)
  const statsQuery = buildStatsQuery(startDate, endDate)
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    ...getSystemStatsOptions(statsQuery ? { query: statsQuery } : undefined),
    refetchInterval: 30_000,
  })
  const { data: tools } = useQuery(
    readToolsOptions({ query: { skip: 0, limit: 1000 } }),
  )

  if (error) {
    return (
      <div className="px-4 py-6 md:px-6 lg:px-8 xl:px-12">
        <div className="border border-destructive bg-destructive/10 p-4 text-destructive">
          Failed to load admin statistics. Please check your permissions and try
          again.
        </div>
      </div>
    )
  }

  const data = stats as SystemStats | undefined
  const runTotal = data?.runs.total ?? 0
  const runStatuses = data?.runs.by_status ?? {}
  const fileTypes = Object.entries(data?.files.by_type ?? {})
    .sort(([, first], [, second]) => second - first)
    .slice(0, 5)
  const fileTypeTotal = Object.values(data?.files.by_type ?? {}).reduce(
    (sum, count) => sum + count,
    0,
  )
  const popularTools = data?.tools.most_popular ?? []
  const toolsByName = new Map(
    (tools?.data ?? []).map((tool: ToolMinimalPublic) => [tool.name, tool]),
  )
  const applyQuickDateFilter = (filter: QuickDateFilter) => {
    setQuickDateFilter(filter)
    if (filter === "all" || filter === "custom") {
      setStartDate("")
      setEndDate("")
      return
    }

    const end = new Date()
    const start = new Date(end)
    if (filter === "today") {
      start.setHours(0, 0, 0, 0)
    } else {
      const days = Number.parseInt(filter, 10)
      start.setDate(start.getDate() - days)
    }

    setStartDate(formatDateTimeLocal(start))
    setEndDate(formatDateTimeLocal(end))
  }

  return (
    <div className="w-full px-4 py-6 md:px-6 lg:px-8 xl:px-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-bold">Admin Dashboard</h1>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label>Range</Label>
            <div className="flex flex-wrap gap-2">
              {quickDateFilters.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  variant={
                    quickDateFilter === filter.value ? "default" : "outline"
                  }
                  onClick={() => applyQuickDateFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-start-date">Start</Label>
            <Input
              id="admin-start-date"
              type="datetime-local"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value)
                setQuickDateFilter("custom")
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-end-date">End</Label>
            <Input
              id="admin-end-date"
              type="datetime-local"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value)
                setQuickDateFilter("custom")
              }}
            />
          </div>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4 ${
          isLoading ? "animate-pulse" : ""
        }`}
      >
        <MetricCard
          title="Total Users"
          value={data?.users.total ?? 0}
          subtitle={`${data?.users.active ?? 0} active`}
          icon={Users}
          iconClassName="text-blue-500"
        />
        <MetricCard
          title="Total Files"
          value={data?.files.total ?? 0}
          subtitle={formatBytes(data?.files.total_size_bytes ?? 0)}
          icon={Database}
          iconClassName="text-emerald-500"
        />
        <MetricCard
          title="Total Runs"
          value={runTotal}
          subtitle={`${data?.runs.currently_running ?? 0} running`}
          icon={Activity}
          iconClassName="text-violet-500"
        />
        <MetricCard
          title="Tools Available"
          value={data?.tools.enabled ?? 0}
          subtitle={`${data?.tools.total ?? 0} total`}
          icon={Wrench}
          iconClassName="text-orange-500"
        />
      </div>

      <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <StatsPanel title="User Statistics">
          <div className="space-y-5">
            <StatValue label="Total Users" value={data?.users.total ?? 0} />
            <StatValue
              label="Active Users"
              value={data?.users.active ?? 0}
              help={`${
                data?.users.total
                  ? (
                      ((data.users.active ?? 0) / data.users.total) *
                      100
                    ).toFixed(1)
                  : "0.0"
              }% of total`}
            />
            <StatValue label="Superusers" value={data?.users.superusers ?? 0} />
            <StatValue
              label="Active Last 30 Days"
              value={data?.users.active_last_30_days ?? 0}
            />
          </div>
        </StatsPanel>

        <StatsPanel title="Run Status Distribution">
          <div className="space-y-4">
            <ProgressRow
              label="Completed"
              count={runStatuses.completed ?? 0}
              total={runTotal}
              colorClassName="bg-emerald-500"
            />
            <ProgressRow
              label="Running"
              count={runStatuses.running ?? 0}
              total={runTotal}
              colorClassName="bg-blue-500"
            />
            <ProgressRow
              label="Pending"
              count={runStatuses.pending ?? 0}
              total={runTotal}
              colorClassName="bg-amber-400"
            />
            <ProgressRow
              label="Failed"
              count={runStatuses.failed ?? 0}
              total={runTotal}
              colorClassName="bg-red-500"
            />
            <ProgressRow
              label="Cancelled"
              count={runStatuses.cancelled ?? 0}
              total={runTotal}
              colorClassName="bg-slate-500"
            />
            <div className="flex justify-between pt-2 text-sm text-muted-foreground">
              <span>Success Rate</span>
              <Badge className="rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                {(data?.runs.success_rate_percent ?? 0).toFixed(1)}%
              </Badge>
            </div>
          </div>
        </StatsPanel>

        <StatsPanel title="Storage Overview">
          <div className="space-y-5">
            <StatValue
              label="Total Storage Used"
              value={`${(data?.files.total_size_gb ?? 0).toFixed(2)} GB`}
            />
            <StatValue
              label="Saved Files Storage"
              value={`${(data?.files.saved_size_gb ?? 0).toFixed(2)} GB`}
              help={`${data?.files.saved ?? 0} files saved permanently`}
            />
            <StatValue
              label="Temporary Files"
              value={data?.files.temporary ?? 0}
              help={`${(
                (data?.files.total_size_gb ?? 0) -
                  (data?.files.saved_size_gb ?? 0)
              ).toFixed(2)} GB`}
            />
          </div>
        </StatsPanel>

        <StatsPanel title="Top File Types">
          <div className="space-y-4">
            {fileTypes.map(([type, count]) => (
              <ProgressRow
                key={type}
                label={type.toUpperCase()}
                count={count}
                total={fileTypeTotal}
                colorClassName="bg-teal-600"
              />
            ))}
            {fileTypes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No files available.
              </p>
            )}
          </div>
        </StatsPanel>

        <StatsPanel title="Most Popular Tools">
          <div className="space-y-3">
            {popularTools.slice(0, 5).map((tool) => (
              <button
                type="button"
                key={tool.name}
                className="flex w-full items-center justify-between gap-4 text-left text-sm"
                onClick={() => {
                  const selectedTool = toolsByName.get(tool.name)
                  if (!selectedTool) return
                  setSelection({
                    type: "tool",
                    id: selectedTool.id,
                    label: selectedTool.name,
                  })
                }}
                disabled={!toolsByName.has(tool.name)}
              >
                <span>{tool.name}</span>
                <Badge className="rounded bg-sky-100 text-sky-800 hover:bg-sky-100">
                  {tool.count} runs
                </Badge>
              </button>
            ))}
            {popularTools.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No runs in this range.
              </p>
            )}
          </div>
        </StatsPanel>

        <StatsPanel title="System Performance">
          <div className="space-y-5">
            <StatValue
              label="Runs Last 24h"
              value={data?.runs.last_24_hours ?? 0}
            />
            <StatValue
              label="Average Runtime"
              value={`${(data?.runs.average_runtime_minutes ?? 0).toFixed(1)} min`}
            />
            <StatValue
              label="Currently Running"
              value={data?.runs.currently_running ?? 0}
            />
            <StatValue
              label="Average File Size"
              value={formatBytes(data?.files.average_size_bytes ?? 0)}
            />
          </div>
        </StatsPanel>
      </div>

      <section className="mt-8">
        <div className="mb-5">
          <h2 className="text-2xl font-bold">Controls</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <StatsPanel title="Create Tool">
            <CreateTool variant="panel" />
          </StatsPanel>
          <LlmSettingsPanel />
          <QueueControls />
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Users</h2>
            <p className="text-sm text-muted-foreground">
              Manage user accounts and permissions
            </p>
          </div>
          <AddUser />
        </div>
        <UsersTable
          onSelectUser={(user) =>
            setSelection({
              type: "user",
              id: user.id,
              label: user.full_name || user.email,
            })
          }
        />
      </section>

      <Sheet
        open={selection !== null}
        onOpenChange={(open) => {
          if (!open) setSelection(null)
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selection?.label}</SheetTitle>
            <SheetDescription>
              {selection?.type === "user" ? "User analytics" : "Tool analytics"}
            </SheetDescription>
          </SheetHeader>
          <DetailPanel
            selection={selection}
            startDate={startDate}
            endDate={endDate}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
