import { useNavigate } from "@tanstack/react-router"
import { FolderOpen, RotateCcw } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ConfirmationDialog } from "@/components/Common/ConfirmationDialog"
import OutputAccordion from "@/components/Runs/OutputAccordion"
import RunTime from "@/components/Runs/RunTime"
import RunTimeline from "@/components/Runs/RunTimeline"
import StatusBadge from "@/components/Runs/StatusBadge"
import { Button } from "@/components/ui/button"
import { api, errorMessage } from "./api"
import { RunFiles } from "./components/RunFiles"
import { RunResults } from "./components/RunResults"
import { ToolImage, useToolImages } from "./components/ToolImage"
import { ToolSidebar } from "./components/ToolSidebar"
import {
  isRunActive,
  type RunLogMessage,
  type RunRecord,
  type ToolConfig,
  toRunPublic,
} from "./contracts"
import { notifyRun, openPath } from "./lib/desktop"

export function RunPage({ toolId, runId }: { toolId: string; runId: string }) {
  const navigate = useNavigate()
  const [record, setRecord] = useState<RunRecord | null>(null)
  const [tool, setTool] = useState<ToolConfig | null>(null)
  const [environment, setEnvironment] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [leaveAction, setLeaveAction] = useState<{
    go: () => void | Promise<void>
  } | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const next = await api.get<RunRecord>(`/runs/${runId}`)
    setRecord(next)
    return next
  }, [runId])

  useEffect(() => {
    void refresh().catch((error) => setLoadError(errorMessage(error)))
    void api
      .get<ToolConfig>("/tool")
      .then(setTool)
      .catch(() => {})
    void api
      .get<{ yml: string | null }>("/environment")
      .then((payload) => setEnvironment(payload.yml))
      .catch(() => {})
  }, [refresh])

  const inProgress = isRunActive(record?.status)
  const images = useToolImages()

  useEffect(() => {
    if (!inProgress) return
    const interval = setInterval(() => {
      void refresh().catch(() => {})
    }, 1000)
    return () => clearInterval(interval)
  }, [inProgress, refresh])

  useEffect(() => {
    const socket = new WebSocket(api.wsUrl(`/runs/${runId}/logs`))
    socket.onmessage = (event) => {
      let message: RunLogMessage
      try {
        message = JSON.parse(String(event.data)) as RunLogMessage
      } catch {
        return
      }
      if (message.type === "log") {
        setLogs((previous) => [...previous, message.line].slice(-2000))
        return
      }
      if (message.type === "status") {
        setRecord((previous) =>
          previous
            ? {
                ...previous,
                status: message.status,
                exit_code: message.exit_code ?? previous.exit_code,
              }
            : previous,
        )
        if (!isRunActive(message.status)) void refresh()
      }
    }
    return () => socket.close()
  }, [runId, refresh])

  // Leaving while the run is still going ends it, so both the sidebar and the
  // way back to the tool ask first.
  async function confirmLeave() {
    if (!leaveAction) return
    setLeaving(true)
    try {
      await api.post(`/runs/${runId}/cancel`).catch(() => {})
      await leaveAction.go()
    } finally {
      setLeaving(false)
      setLeaveAction(null)
    }
  }

  function goBack() {
    if (inProgress) {
      setLeaveAction({
        go: () => navigate({ to: "/t/$toolId/tool", params: { toolId } }),
      })
      return
    }
    void navigate({ to: "/t/$toolId/tool", params: { toolId } })
  }

  async function cancel() {
    try {
      await api.post(`/runs/${runId}/cancel`)
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  // A run reaching a terminal state notifies the OS once, so a backgrounded
  // app still tells the user. Best-effort: nothing happens without the bridge.
  const notifiedRef = useRef(false)
  useEffect(() => {
    const status = record?.status
    if (!status || isRunActive(status) || notifiedRef.current) return
    notifiedRef.current = true
    const outcome =
      status === "completed"
        ? "completed"
        : status === "cancelled"
          ? "cancelled"
          : "failed"
    notifyRun(
      `${tool?.name ?? "Run"} ${outcome}`,
      record?.name ?? `Run ${runId.slice(0, 8)} ${outcome}`,
    )
  }, [record?.status, tool?.name, runId, record?.name])

  const stdoutTail = record?.stdout
    ? record.stdout.trimEnd().split("\n").slice(-30).join("\n")
    : ""
  // The record carries the history; the socket carries lines since the page
  // opened. The timeline needs every marker occurrence, repeats included, so a
  // tool that loops is shown going back through the steps.
  const timelineLogs = [record?.stdout ?? "", ...logs]
    .filter(Boolean)
    .join("\n")
  const run = record && tool ? toRunPublic(record, tool, environment) : null

  return (
    <div className="flex h-full">
      <ToolSidebar
        activeToolId={tool?.id ?? null}
        beforeOpen={(toolId) => {
          if (!inProgress || toolId === tool?.id) return true
          setLeaveAction({ go: () => window.cpgRunner?.openTool(toolId) })
          return false
        }}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b px-8 py-6">
          <div className="mx-auto mb-3 max-w-6xl min-w-0">
            <button
              type="button"
              className="hover:text-primary flex items-center font-semibold whitespace-nowrap"
              onClick={goBack}
            >
              ← Back to {tool?.name ?? "the tool"}
            </button>
          </div>
          <div className="mx-auto flex max-w-6xl flex-wrap min-w-0 items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {tool && (
                <ToolImage
                  id={tool.id}
                  name={tool.name}
                  images={images}
                  className="size-9"
                />
              )}
              <h1 className="text-xl font-semibold">
                {record?.name ||
                  `Run ${record?.id ? record.id.slice(0, 8) : runId.slice(0, 8)}`}
              </h1>
              {record && <StatusBadge status={record.status} />}
              {record && (
                <span className="text-muted-foreground text-sm">
                  <RunTime
                    started_at={record.started_at ?? null}
                    finished_at={record.finished_at ?? null}
                    status={record.status}
                  />
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {record && !inProgress && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label="Rerun this run"
                  onClick={() =>
                    void navigate({
                      to: "/t/$toolId/tool",
                      params: { toolId },
                      search: { rerun: record.id },
                    })
                  }
                >
                  <RotateCcw />
                  Rerun
                </Button>
              )}
              {inProgress && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void cancel()}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto px-8 py-6">
          <div className="mx-auto grid max-w-6xl min-w-0 gap-6 [&>*]:min-w-0">
            {loadError && (
              <p className="text-destructive text-sm">{loadError}</p>
            )}

            {record?.status === "failed" && (
              <section className="grid gap-2">
                <h2 className="text-lg font-semibold">Failure</h2>
                {record.error && (
                  <p className="text-destructive text-sm">{record.error}</p>
                )}
                {stdoutTail && (
                  <pre className="bg-muted overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
                    {stdoutTail}
                  </pre>
                )}
              </section>
            )}

            {record && tool && (
              <RunTimeline
                steps={tool.timeline ?? []}
                logs={timelineLogs}
                status={record.status}
                border={false}
              />
            )}

            {record && !isRunActive(record.status) && (
              <>
                <RunFiles
                  files={record.files ?? []}
                  onOpenOutputFolder={
                    record.output_dir
                      ? () => openPath(record.output_dir as string)
                      : undefined
                  }
                />
                <RunResults runId={runId} files={record.files ?? []} />
              </>
            )}

            {run && (
              <OutputAccordion
                run={run}
                logStream={{ lines: logs, status: record?.status }}
              />
            )}

            {(record?.output_dir || record?.work_dir) && (
              <section className="grid gap-2 rounded-md border p-4">
                <div className="flex items-center gap-2">
                  <FolderOpen className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Locations</h3>
                </div>
                <div className="grid gap-2">
                  {record?.output_dir && (
                    <div className="flex items-center gap-x-3">
                      <span className="text-muted-foreground w-24 shrink-0 text-xs">
                        Output folder
                      </span>
                      <span
                        className="min-w-0 flex-1 truncate font-mono text-xs"
                        title={record.output_dir}
                      >
                        {record.output_dir}
                      </span>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto shrink-0 p-0 text-xs"
                        onClick={() => openPath(record.output_dir as string)}
                      >
                        Open
                      </Button>
                    </div>
                  )}
                  {record?.work_dir && (
                    <div className="flex items-center gap-x-3">
                      <span className="text-muted-foreground w-24 shrink-0 text-xs">
                        Work folder
                      </span>
                      <span
                        className="min-w-0 flex-1 truncate font-mono text-xs"
                        title={record.work_dir}
                      >
                        {record.work_dir}
                      </span>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto shrink-0 p-0 text-xs"
                        onClick={() => openPath(record.work_dir as string)}
                      >
                        Open
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      <ConfirmationDialog
        open={leaveAction !== null}
        onOpenChange={(open) => {
          if (!open) setLeaveAction(null)
        }}
        title="Cancel this run?"
        description="This run is still going. Leaving this page ends it."
        confirmLabel="Cancel run and leave"
        pending={leaving}
        onConfirm={() => void confirmLeave()}
      />
    </div>
  )
}
