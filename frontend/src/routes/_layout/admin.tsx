import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import {
  Activity,
  Database,
  type LucideIcon,
  Users,
  Wrench,
} from "lucide-react"
import { Suspense } from "react"

import { type SystemStats, type UserPublic, UsersService } from "@/client"
import {
  getSystemStatsOptions,
  readUsersOptions,
} from "@/client/@tanstack/react-query.gen"
import AddUser from "@/components/Admin/AddUser"
import { columns, type UserTableData } from "@/components/Admin/columns"
import { DataTable } from "@/components/Common/DataTable"
import PendingUsers from "@/components/Pending/PendingUsers"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"

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

function UsersTableContent() {
  const { user: currentUser } = useAuth()
  const { data: users } = useSuspenseQuery(getUsersQueryOptions())
  const tableData: UserTableData[] = users.data.map((user: UserPublic) => ({
    ...user,
    isCurrentUser: currentUser?.id === user.id,
  }))
  return <DataTable columns={columns} data={tableData} />
}

function UsersTable() {
  return (
    <Suspense fallback={<PendingUsers />}>
      <UsersTableContent />
    </Suspense>
  )
}

function AdminDashboard() {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    ...getSystemStatsOptions(),
    refetchInterval: 30_000,
  })

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
  const popularTools = (data?.tools.most_popular ?? []) as Array<{
    name: string
    count: number
  }>

  return (
    <div className="w-full px-4 py-6 md:px-6 lg:px-8 xl:px-12">
      <h1 className="mb-6 text-4xl font-bold">Admin Dashboard</h1>

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
              <div
                key={tool.name}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span>{tool.name}</span>
                <Badge className="rounded bg-sky-100 text-sky-800 hover:bg-sky-100">
                  {tool.count} runs
                </Badge>
              </div>
            ))}
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
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Users</h2>
            <p className="text-sm text-muted-foreground">
              Manage user accounts and permissions
            </p>
          </div>
          <AddUser />
        </div>
        <Card className="rounded border-border shadow-sm">
          <CardContent className="p-0">
            <UsersTable />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
