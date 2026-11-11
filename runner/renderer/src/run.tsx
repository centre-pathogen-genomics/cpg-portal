import { RotateCcw } from "lucide-react"
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/Common/ConfirmationDialog"
import OutputAccordion from "@/components/Runs/OutputAccordion";
import RunTime from "@/components/Runs/RunTime";
import StatusBadge from "@/components/Runs/StatusBadge";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "./api";
import { RunFiles } from "./components/RunFiles";
import { RunResults } from "./components/RunResults";
import { ToolSidebar } from "./components/ToolSidebar";
import {
  isRunActive,
  type RunLogMessage,
  type RunRecord,
  type ToolConfig,
  toRunPublic,
} from "./contracts";
import { openPath } from "./lib/desktop";
import { navigate } from "./router";

export function RunPage({ id }: { id: string }) {
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [tool, setTool] = useState<ToolConfig | null>(null);
  const [environment, setEnvironment] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([])
  const [leavingTo, setLeavingTo] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await api.get<RunRecord>(`/runs/${id}`);
    setRecord(next);
    return next;
  }, [id]);

  useEffect(() => {
    void refresh().catch((error) => setLoadError(errorMessage(error)));
    void api
      .get<ToolConfig>("/tool")
      .then(setTool)
      .catch(() => {});
    void api
      .get<{ yml: string | null }>("/environment")
      .then((payload) => setEnvironment(payload.yml))
      .catch(() => {});
  }, [refresh]);

  const inProgress = isRunActive(record?.status);

  useEffect(() => {
    if (!inProgress) return;
    const interval = setInterval(() => {
      void refresh().catch(() => {});
    }, 1000);
    return () => clearInterval(interval);
  }, [inProgress, refresh]);

  useEffect(() => {
    const socket = new WebSocket(api.wsUrl(`/runs/${id}/logs`));
    socket.onmessage = (event) => {
      let message: RunLogMessage;
      try {
        message = JSON.parse(String(event.data)) as RunLogMessage;
      } catch {
        return;
      }
      if (message.type === "log") {
        setLogs((previous) => [...previous, message.line].slice(-2000));
        return;
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
        );
        if (!isRunActive(message.status)) void refresh();
      }
    };
    return () => socket.close();
  }, [id, refresh]);

  // Leaving while the run is still going ends it, so the sidebar asks first.
  async function leave(toolId: string) {
    setLeaving(true)
    try {
      await api.post(`/runs/${id}/cancel`).catch(() => {})
      await window.cpgRunner?.openTool(toolId)
    } finally {
      setLeaving(false)
      setLeavingTo(null)
    }
  }

  async function cancel() {
    try {
      await api.post(`/runs/${id}/cancel`);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const stdoutTail = record?.stdout
    ? record.stdout.trimEnd().split("\n").slice(-30).join("\n")
    : "";
  const run = record && tool ? toRunPublic(record, tool, environment) : null;

  return (
    <div className="flex h-full">
      <ToolSidebar
        activeToolId={tool?.id ?? null}
        beforeOpen={(toolId) => {
          if (!inProgress || toolId === tool?.id) return true
          setLeavingTo(toolId)
          return false
        }}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b px-8 py-6">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold">
                {record?.name ||
                  `Run ${record?.id ? record.id.slice(0, 8) : id.slice(0, 8)}`}
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
                  onClick={() => navigate(`/tool?rerun=${record.id}`)}
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
          <div className="mx-auto grid max-w-4xl gap-6">
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
                <RunResults runId={id} files={record.files ?? []} />
              </>
            )}

            {run && (
              <OutputAccordion
                run={run}
                logStream={{ lines: logs, status: record?.status }}
              />
            )}

            {(record?.output_dir || record?.work_dir) && (
              <footer className="text-muted-foreground grid gap-1 border-t pt-4 text-xs">
                {record?.work_dir && (
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span>Work folder</span>
                    <span className="font-mono break-all">
                      {record.work_dir}
                    </span>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs"
                      onClick={() => openPath(record.work_dir as string)}
                    >
                      Open
                    </Button>
                  </div>
                )}
              </footer>
            )}
          </div>
        </main>
      </div>

      <ConfirmationDialog
        open={leavingTo !== null}
        onOpenChange={(open) => {
          if (!open) setLeavingTo(null)
        }}
        title="Cancel this run?"
        description="This run is still going. Opening another tool ends it here."
        confirmLabel="Cancel run and leave"
        pending={leaving}
        onConfirm={() => {
          if (leavingTo) void leave(leavingTo)
        }}
      />
    </div>
  )
}
