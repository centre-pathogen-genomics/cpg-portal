import { Check, Circle, History, LoaderCircle, Minus, X } from "lucide-react"
import { useMemo } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { RunStatus, TimelineStep } from "../../client"

type StepState =
  | "completed"
  | "active"
  | "next"
  | "pending"
  | "skipped"
  | "failed"

const terminalStatuses = new Set(["completed", "failed", "cancelled"])
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")

const matches = (logs: string, pattern: string) => {
  try {
    return new RegExp(pattern, "i").test(logs)
  } catch {
    // A pattern that is not valid regex is still useful as plain text.
    return logs.toLowerCase().includes(pattern.toLowerCase())
  }
}

const stateLabel: Record<StepState, string> = {
  completed: "Done",
  active: "Running",
  next: "Up next",
  pending: "Waiting",
  skipped: "Missed",
  failed: "Failed",
}

const stateStyles: Record<StepState, string> = {
  completed:
    "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
  active:
    "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px] shadow-primary/15",
  next: "border-amber-500 bg-amber-400 text-amber-950 shadow-sm",
  pending: "border-border bg-muted text-muted-foreground",
  skipped: "border-dashed border-border bg-background text-muted-foreground",
  failed:
    "border-destructive bg-destructive text-white shadow-sm shadow-destructive/30",
}

const StepIcon = ({ state }: { state: StepState }) => {
  if (state === "completed") return <Check className="size-3.5" />
  if (state === "active")
    return <LoaderCircle className="size-3.5 animate-spin" />
  if (state === "skipped") return <Minus className="size-3.5" />
  if (state === "next") return <Circle className="size-2.5 fill-current" />
  if (state === "failed") return <X className="size-3.5" />
  return <Circle className="size-2.5 fill-current opacity-40" />
}

/** An explicit step rendered verbatim (e.g. an install's phases). */
export interface TimelinePhase {
  id: string
  name: string
  state: StepState
  detail?: string
}

interface RunTimelineProps {
  steps: TimelineStep[]
  logs: string
  status: RunStatus
  border?: boolean
  /** Explicit steps to render; when given, log pattern-matching is skipped. */
  phases?: TimelinePhase[]
  /** Heading title, defaults to "Run timeline". */
  title?: string
}

type Row =
  | {
      key: string
      name: string
      state: StepState
      pattern: string
      detail: null
    }
  | {
      key: string
      name: string
      state: StepState
      pattern: null
      detail: string | undefined
    }

function RunTimeline({
  steps,
  logs,
  status,
  border,
  phases,
  title,
}: RunTimelineProps) {
  const cleanLogs = useMemo(() => logs.replace(ANSI_ESCAPE, ""), [logs])
  const finished = terminalStatuses.has(status)
  const running = status === "running"
  const states = useMemo(() => {
    let activeIndex = -1
    return steps.map<StepState>((step, index) => {
      if (activeIndex !== -1) {
        if (!finished && running && index === activeIndex + 1) return "next"
        return finished ? "skipped" : "pending"
      }
      if (matches(cleanLogs, step.pattern)) return "completed"
      activeIndex = index
      return finished ? "skipped" : "active"
    })
  }, [cleanLogs, finished, running, steps])

  const deduced = phases === undefined
  // A completed run's timeline is just a row of ticks; the logs and results
  // are the useful part. Keep it for active runs, and for failed or cancelled
  // runs where it shows where the run stopped (with the Finish node reflecting
  // the failure or cancellation). Explicit phases (installs) stay visible even
  // when finished.
  if (deduced && (steps.length === 0 || status === "completed")) return null

  // The trailing Finish state: complete only when the run completes; failed or
  // cancelled runs stop short of it.
  const finishState: StepState =
    status === "completed"
      ? "completed"
      : status === "failed"
        ? "failed"
        : status === "cancelled"
          ? "skipped"
          : running
            ? "next"
            : "pending"

  const rows: Row[] = deduced
    ? [
        ...steps.map((step, index) => ({
          key: `${step.name}-${index}`,
          name: step.name,
          state: states[index],
          pattern: step.pattern,
          detail: null,
        })),
        {
          key: "finish",
          name: "Finish",
          state: finishState,
          pattern: null,
          detail: undefined,
        },
      ]
    : phases.map((phase) => ({
        key: phase.id,
        name: phase.name,
        state: phase.state,
        pattern: null,
        detail: phase.detail,
      }))

  const completed = rows.filter((row) => row.state === "completed").length

  return (
    <section
      className={cn(
        "mb-6 rounded-xl bg-card p-4 shadow-sm",
        border && "border",
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{title ?? "Run timeline"}</h2>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs tabular-nums">
          {completed}/{rows.length}
        </span>
      </div>
      <ol>
        {rows.map((row, index) => {
          const state = row.state
          const future = state === "pending" || state === "next"
          return (
            <li
              key={row.key}
              className="relative flex gap-3 pb-5 last:pb-0"
              aria-current={state === "active" ? "step" : undefined}
            >
              {index < rows.length - 1 && (
                <span
                  className={cn(
                    "absolute top-7 left-3 h-[calc(100%-1.25rem)] w-0.5 rounded-full",
                    state === "completed" ? "bg-emerald-400" : "bg-border",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  stateStyles[state],
                )}
              >
                <StepIcon state={state} />
              </span>
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pt-0.5">
                <div className="min-w-0">
                  {row.pattern ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "cursor-help decoration-muted-foreground/50 underline-offset-4 hover:underline",
                            state === "active" || state === "next"
                              ? "font-semibold text-foreground"
                              : state === "completed"
                                ? "text-foreground"
                                : state === "failed"
                                  ? "font-medium text-destructive"
                                  : "text-muted-foreground",
                          )}
                        >
                          {row.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Pattern: <code>{row.pattern}</code>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span
                      className={cn(
                        state === "active" || state === "next"
                          ? "font-semibold text-foreground"
                          : state === "completed"
                            ? "text-foreground"
                            : state === "failed"
                              ? "font-medium text-destructive"
                              : "text-muted-foreground",
                      )}
                    >
                      {row.name}
                    </span>
                  )}
                  {state === "active" && (
                    <p className="mt-1 text-muted-foreground text-xs">
                      {row.detail ??
                        (row.pattern ? (
                          <>
                            Waiting for <code>{row.pattern}</code> in the logs…
                          </>
                        ) : (
                          "Starting…"
                        ))}
                    </p>
                  )}
                  {state === "failed" && (
                    <p className="mt-1 text-destructive text-xs">
                      {row.detail || "Failed"}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    state === "completed" &&
                      "text-emerald-600 dark:text-emerald-400",
                    state === "active" && "text-primary",
                    state === "next" && "text-amber-600 dark:text-amber-400",
                    state === "failed" && "text-destructive",
                    state === "pending" && "text-muted-foreground/60",
                    state === "skipped" && "text-muted-foreground/60",
                    future && "font-medium",
                  )}
                >
                  {stateLabel[state]}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default RunTimeline
