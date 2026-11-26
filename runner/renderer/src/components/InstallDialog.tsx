import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import RunTimeline, { type TimelinePhase } from "@/components/Runs/RunTimeline"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api, errorMessage } from "../api"
import type { InstallMessage, ToolConfig } from "../contracts"
import { LogPanel } from "./LogPanel"

/** The installer's steps, in order. A step exists only once it is mentioned. */
const PHASES = [
  { id: "image", title: "Runtime image" },
  { id: "environment", title: "Tool environment" },
  { id: "post-install", title: "Post-install" },
] as const

const DONE_LINES = [
  "Runtime image is already installed.",
  "Loading runtime image…",
  "Tool environment is already installed.",
  "Tool environment installed.",
  "Post-install finished.",
]

const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")

/** The "still going" beats are not progress: a step's detail should show the
 * latest real output line instead of one of these. */
function isHeartbeat(line: string): boolean {
  return (
    /^Still installing the environment \(\d+s\)$/.test(line) ||
    /^Still running post-install \(\d+s\)$/.test(line)
  )
}

/** A step's detail is exactly one line: flatten any embedded newlines/tabs and
 * cap the length so a long package-manager line cannot wrap the timeline. */
const MAX_DETAIL_LENGTH = 120
function oneLine(line: string): string {
  const cleaned = line.replace(ANSI_ESCAPE, "").replace(/\s+/g, " ").trim()
  return cleaned.length > MAX_DETAIL_LENGTH
    ? `${cleaned.slice(0, MAX_DETAIL_LENGTH - 1)}…`
    : cleaned
}

function phaseOf(line: string): string | null {
  if (
    line.startsWith("Downloading runtime image") ||
    line.startsWith("Runtime image") ||
    line.startsWith("Loading runtime image")
  )
    return "image"
  if (
    line.startsWith("Installing tool environment") ||
    line.startsWith("Tool environment") ||
    line.startsWith("Still installing the environment")
  )
    return "environment"
  if (
    line.startsWith("Running post-install") ||
    line.startsWith("Post-install") ||
    line.startsWith("Still running post-install")
  )
    return "post-install"
  return null
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
  cancelled = false,
): TimelinePhase[] {
  const states: Record<string, TimelinePhase["state"]> = {}
  const details: Record<string, string> = {}
  for (const phase of PHASES) states[phase.id] = "pending"
  let current: string | null = null
  for (const line of lines) {
    const id = phaseOf(line)
    if (id) {
      if (DONE_LINES.includes(line)) {
        states[id] = "completed"
        details[id] = ""
        current = null
      } else {
        states[id] = "active"
        current = id
        // A heartbeat only says the phase is alive; keep the last real line.
        if (!isHeartbeat(line)) details[id] = oneLine(line)
      }
      for (const phase of PHASES) {
        if (phase.id === id) break
        if (states[phase.id] === "active") states[phase.id] = "completed"
      }
      continue
    }
    // Output from the running package manager (and its errors) belongs to the
    // step that is running, so the step's detail tracks the latest line.
    if (current && !isHeartbeat(line)) {
      const cleaned = oneLine(line)
      if (cleaned) details[current] = cleaned
    }
  }
  if (finished || failed || cancelled) {
    // The installer's own error is a line that belongs to no step.
    const error = failed
      ? ([...lines].reverse().find((line) => phaseOf(line) === null) ?? "")
      : ""
    for (const phase of PHASES) {
      if (states[phase.id] === "active") {
        states[phase.id] = failed
          ? "failed"
          : cancelled
            ? "skipped"
            : "completed"
        if (failed && error) details[phase.id] = oneLine(error)
      }
    }
  }
  return PHASES.filter((phase) => states[phase.id] !== "pending").map(
    (phase) => ({
      id: phase.id,
      name: phase.title,
      state: states[phase.id],
      detail: details[phase.id] ?? "",
    }),
  )
}

export function InstallDialog({
  open,
  tool,
  installing,
  onRefreshStatus,
  onDismiss,
}: {
  open: boolean
  tool: ToolConfig | null
  installing: boolean
  onRefreshStatus: () => void
  onDismiss: () => void
}) {
  const [lines, setLines] = useState<string[]>([])
  const [working, setWorking] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)

  const closeSocket = useCallback(() => {
    socketRef.current?.close()
    socketRef.current = null
  }, [])

  const subscribe = useCallback(() => {
    closeSocket()
    const socket = new WebSocket(api.wsUrl("/install/logs"))
    socketRef.current = socket
    socket.onmessage = (event) => {
      let message: InstallMessage
      try {
        message = JSON.parse(String(event.data)) as InstallMessage
      } catch {
        return
      }
      if (message.type === "log") {
        setLines((previous) => [...previous, message.line].slice(-500))
      } else if (message.type === "state") {
        if (message.state === "installed") {
          closeSocket()
          setWorking(false)
          setFinished(true)
          setFailure(null)
          onRefreshStatus()
        } else if (message.state === "failed") {
          closeSocket()
          setWorking(false)
          setFinished(true)
          setFailure("Installation failed")
        } else if (message.state === "not_installed") {
          // The installer reports this after a cancel: it cleaned up what the
          // interrupted install made and is ready to be retried.
          closeSocket()
          setWorking(false)
          setCancelling(false)
          setFinished(true)
          setCancelled(true)
          setFailure(null)
          onRefreshStatus()
        }
      }
    }
    socket.onerror = () => {
      closeSocket()
      setWorking(false)
      setFailure(
        (previous) => previous ?? "The installation log connection was lost",
      )
    }
  }, [closeSocket, onRefreshStatus])

  useEffect(() => closeSocket, [closeSocket])

  useEffect(() => {
    if (!open || !installing || socketRef.current) return
    subscribe()
  }, [open, installing, subscribe])

  async function startInstall() {
    if (working) return
    setWorking(true)
    setFailure(null)
    setFinished(false)
    setCancelled(false)
    setCancelling(false)
    setLines([])
    try {
      await api.post("/install")
    } catch (error) {
      toast.error(errorMessage(error))
      setWorking(false)
      onRefreshStatus()
      return
    }
    subscribe()
  }

  async function cancelInstall() {
    if (cancelling) return
    setCancelling(true)
    try {
      await api.post("/install/cancel")
    } catch (error) {
      toast.error(errorMessage(error))
      setCancelling(false)
    }
  }

  const timeline = useMemo(
    () =>
      buildTimeline(
        lines,
        finished && !failure && !cancelled,
        Boolean(failure),
        cancelled,
      ),
    [lines, finished, failure, cancelled],
  )
  const busy = working || installing

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
            <RunTimeline
              phases={timeline}
              title="Install timeline"
              steps={[]}
              logs=""
              status={finished ? "completed" : "running"}
              border
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              Nothing has been installed yet.
            </p>
          )}

          {failure && (
            <p className="text-destructive mt-3 text-sm">{failure}</p>
          )}

          {cancelled && (
            <p className="text-muted-foreground mt-3 text-sm">
              Installation cancelled.
            </p>
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
          {busy ? (
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling}
              onClick={() => void cancelInstall()}
            >
              {cancelling ? "Cancelling…" : "Cancel"}
            </Button>
          ) : (
            <Button type="button" onClick={() => void startInstall()}>
              {failure || cancelled ? "Retry" : "Install"}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onDismiss}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
