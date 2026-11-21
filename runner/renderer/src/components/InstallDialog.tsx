import { Check, Circle, History, LoaderCircle, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, errorMessage } from "../api";
import type { InstallMessage, ToolConfig } from "../contracts";
import { LogPanel } from "./LogPanel";

/** The installer's steps, in order. A step exists only once it is mentioned. */
const PHASES = [
  { id: "image", title: "Runtime image" },
  { id: "environment", title: "Tool environment" },
  { id: "post-install", title: "Post-install" },
] as const;

type PhaseState = "done" | "active" | "failed" | "pending";

const stateLabel: Record<PhaseState, string> = {
  done: "Done",
  active: "Installing",
  failed: "Failed",
  pending: "Waiting",
};

// The same rail and node language as the portal's RunTimeline, so an install
// reads like a run: a filled node per finished step, a spinner on the current
// one, and a grey node for what has not started.
const stateStyles: Record<PhaseState, string> = {
  done: "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
  active:
    "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px] shadow-primary/15",
  failed:
    "border-destructive bg-destructive text-white shadow-sm shadow-destructive/30",
  pending: "border-border bg-muted text-muted-foreground",
};

const PhaseIcon = ({ state }: { state: PhaseState }) => {
  if (state === "done") return <Check className="size-3.5" />;
  if (state === "failed") return <X className="size-3.5" />;
  if (state === "active")
    return <LoaderCircle className="size-3.5 animate-spin" />;
  return <Circle className="size-2.5 fill-current" />;
};

const DONE_LINES = [
  "Runtime image is already installed.",
  "Loading runtime image…",
  "Tool environment is already installed.",
  "Tool environment installed.",
  "Post-install finished.",
];

function phaseOf(line: string): string | null {
  if (
    line.startsWith("Downloading runtime image") ||
    line.startsWith("Runtime image") ||
    line.startsWith("Loading runtime image")
  )
    return "image";
  if (
    line.startsWith("Installing tool environment") ||
    line.startsWith("Tool environment") ||
    line.startsWith("Still installing the environment")
  )
    return "environment";
  if (
    line.startsWith("Running post-install") ||
    line.startsWith("Post-install") ||
    line.startsWith("Still running post-install")
  )
    return "post-install";
  return null;
}

/**
 * Turns the installer's log into the steps it went through: a step is active
 * while its lines keep coming (the heartbeat ones included) and done once its
 * closing line arrives. Steps the tool never mentions stay hidden.
 */
function buildTimeline(
  lines: string[],
  finished: boolean,
  failed: boolean,
): { id: string; title: string; state: PhaseState; detail: string }[] {
  const states: Record<string, PhaseState> = {};
  const details: Record<string, string> = {};
  for (const phase of PHASES) states[phase.id] = "pending";
  for (const line of lines) {
    const id = phaseOf(line);
    if (!id) continue;
    if (DONE_LINES.includes(line)) {
      states[id] = "done";
      details[id] = "";
    } else {
      states[id] = "active";
      details[id] = line.replace(/…$/, "");
    }
    for (const phase of PHASES) {
      if (phase.id === id) break;
      if (states[phase.id] === "active") states[phase.id] = "done";
    }
  }
  if (finished || failed) {
    // The installer's own error is a line that belongs to no step.
    const error = failed
      ? ([...lines].reverse().find((line) => phaseOf(line) === null) ?? "")
      : "";
    for (const phase of PHASES) {
      if (states[phase.id] === "active") {
        states[phase.id] = failed ? "failed" : "done";
        if (failed && error) details[phase.id] = error;
      }
    }
  }
  return PHASES.filter((phase) => states[phase.id] !== "pending").map(
    (phase) => ({
      ...phase,
      state: states[phase.id],
      detail: details[phase.id] ?? "",
    }),
  );
}

export function InstallDialog({
  open,
  tool,
  installing,
  onRefreshStatus,
  onDismiss,
}: {
  open: boolean;
  tool: ToolConfig | null;
  installing: boolean;
  onRefreshStatus: () => void;
  onDismiss: () => void;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  const closeSocket = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
  }, []);

  const subscribe = useCallback(() => {
    closeSocket();
    const socket = new WebSocket(api.wsUrl("/install/logs"));
    socketRef.current = socket;
    socket.onmessage = (event) => {
      let message: InstallMessage;
      try {
        message = JSON.parse(String(event.data)) as InstallMessage;
      } catch {
        return;
      }
      if (message.type === "log") {
        setLines((previous) => [...previous, message.line].slice(-500));
      } else if (message.type === "state") {
        if (message.state === "installed") {
          closeSocket();
          setWorking(false);
          setFinished(true);
          setFailure(null);
          onRefreshStatus();
        } else if (message.state === "failed") {
          closeSocket();
          setWorking(false);
          setFinished(true);
          setFailure("Installation failed");
        }
      }
    };
    socket.onerror = () => {
      closeSocket();
      setWorking(false);
      setFailure(
        (previous) => previous ?? "The installation log connection was lost",
      );
    };
  }, [closeSocket, onRefreshStatus]);

  useEffect(() => closeSocket, [closeSocket]);

  useEffect(() => {
    if (!open || !installing || socketRef.current) return;
    subscribe();
  }, [open, installing, subscribe]);

  async function startInstall() {
    if (working) return;
    setWorking(true);
    setFailure(null);
    setFinished(false);
    setLines([]);
    try {
      await api.post("/install");
    } catch (error) {
      toast.error(errorMessage(error));
      setWorking(false);
      onRefreshStatus();
      return;
    }
    subscribe();
  }

  const timeline = useMemo(
    () => buildTimeline(lines, finished && !failure, Boolean(failure)),
    [lines, finished, failure],
  );
  const busy = working || installing;
  const completed = timeline.filter((phase) => phase.state === "done").length;

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Install {tool?.name ?? "the tool"}</DialogTitle>
          <DialogDescription>
            The first start downloads the runtime image and installs the tool
            environment.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto pr-1">
          {timeline.length > 0 ? (
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <History className="text-muted-foreground size-4" />
                  <h2 className="text-sm font-semibold">Install timeline</h2>
                </div>
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">
                  {completed}/{timeline.length}
                </span>
              </div>
              <ol>
                {timeline.map((phase, index) => (
                  <li
                    key={phase.id}
                    className="relative flex gap-3 pb-5 last:pb-0"
                    aria-current={
                      phase.state === "active" ? "step" : undefined
                    }
                  >
                    {index < timeline.length - 1 && (
                      <span
                        className={cn(
                          "absolute top-7 left-3 h-[calc(100%-1.25rem)] w-0.5 rounded-full",
                          phase.state === "done"
                            ? "bg-emerald-400"
                            : "bg-border",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                        stateStyles[phase.state],
                      )}
                    >
                      <PhaseIcon state={phase.state} />
                    </span>
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pt-0.5">
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-sm",
                            phase.state === "active" &&
                              "font-semibold text-foreground",
                            phase.state === "done" && "text-foreground",
                            phase.state === "failed" &&
                              "font-medium text-destructive",
                            phase.state === "pending" &&
                              "text-muted-foreground",
                          )}
                        >
                          {phase.title}
                        </p>
                        {phase.state === "active" && (
                          <p className="text-muted-foreground mt-1 text-xs">
                            {phase.detail || "Starting…"}
                          </p>
                        )}
                        {phase.state === "failed" && (
                          <p className="text-destructive mt-1 text-xs">
                            {phase.detail || "Failed"}
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          phase.state === "done" &&
                            "text-emerald-600 dark:text-emerald-400",
                          phase.state === "active" && "text-primary",
                          phase.state === "failed" && "text-destructive",
                          phase.state === "pending" &&
                            "text-muted-foreground/60",
                        )}
                      >
                        {stateLabel[phase.state]}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nothing has been installed yet.
            </p>
          )}

          {failure && (
            <p className="text-destructive mt-3 text-sm">{failure}</p>
          )}

          {lines.length > 0 && (
            <details className="mt-4">
              <summary className="text-muted-foreground cursor-pointer text-xs">
                Show the log
              </summary>
              <LogPanel lines={lines} className="mt-2 h-40" />
            </details>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void startInstall()}
          >
            {busy ? "Installing…" : failure ? "Retry" : "Install"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDismiss}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
