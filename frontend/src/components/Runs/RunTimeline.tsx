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

/** Every log position a step's pattern matches at, in log order.
 *
 * The timeline normally advances when a step's marker line appears. A tool
 * that loops prints the same markers again, so the positions are used to
 * notice a repeat and start a new pass at that step.
 */
const occurrencePositions = (
  logs: string,
  pattern: string,
): { position: number; length: number }[] => {
  const matches: { position: number; length: number }[] = []
  try {
    const regex = new RegExp(pattern, "gi")
    let match = regex.exec(logs)
    while (match !== null) {
      matches.push({ position: match.index, length: match[0].length })
      // An empty match would not advance lastIndex on its own.
      if (match[0] === "") regex.lastIndex += 1
      match = regex.exec(logs)
    }
    return matches
  } catch {
    // A pattern that is not valid regex is still useful as plain text.
    const needle = pattern.toLowerCase()
    const haystack = logs.toLowerCase()
    let from = 0
    while (from <= haystack.length) {
      const at = haystack.indexOf(needle, from)
      if (at === -1) break
      matches.push({ position: at, length: needle.length })
      from = at + Math.max(needle.length, 1)
    }
    return matches
  }
}

const stateLabel: Record<StepState, string> = {
  completed: "Done",
  active: "Running",
  next: "Up next",
  pending: "Waiting",
  skipped: "Skipped",
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
  /** Heading title, defaults to "Timeline". */
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
  const { states, iteration } = useMemo(() => {
    // At one log position the most specific (longest) match wins: a short
    // pattern that only matches because it prefixes a longer step's marker
    // (e.g. "test" inside "test2") must not read as that earlier step looping.
    const bestAt = new Map<number, { length: number; step: number }>()
    steps.forEach((step, index) => {
      for (const { position, length } of occurrencePositions(
        cleanLogs,
        step.pattern,
      )) {
        const current = bestAt.get(position)
        if (
          current === undefined ||
          length > current.length ||
          (length === current.length && index > current.step)
        ) {
          bestAt.set(position, { length, step: index })
        }
      }
    })

    // Walk the marker lines in log order. A step advances the timeline when
    // its line appears; a line for a step already reached (or the same step
    // again) means the tool looped, so the next pass starts there and the
    // timeline moves back to that step. Within a pass the steps before the
    // current one are done, the current one is running, and later ones are
    // still to come; a step skipped earlier in the pass reads as skipped.
    const sequence = [...bestAt.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, winner]) => winner.step)

    let cursor = -1
    let pass = new Set<number>()
    let iterations = 1
    for (const stepIndex of sequence) {
      if (stepIndex <= cursor) {
        // Back to a step already reached, or the same step again: the next
        // pass started here.
        if (cursor >= 0) iterations += 1
        pass = new Set([stepIndex])
      } else {
        pass.add(stepIndex)
      }
      cursor = stepIndex
    }

    const states = steps.map<StepState>((_step, index) => {
      if (pass.has(index)) {
        if (index < cursor) return "completed"
        if (!finished) return "active"
        // The run ended while this step was running.
        return status === "completed" ? "completed" : "skipped"
      }
      if (index < cursor) return "skipped"
      if (!finished && running && index === cursor + 1) return "next"
      return finished ? "skipped" : "pending"
    })
    return { states, iteration: iterations }
  }, [cleanLogs, finished, running, status, steps])

  const deduced = phases === undefined
  // A completed run's timeline is just a row of ticks; the logs and results
  // are the useful part. Keep it for active runs, and for failed or cancelled
  // runs where it shows where the run stopped (with the Finish node reflecting
  // the failure or cancellation). Explicit phases (installs) stay visible even
  // when finished.
  if (deduced && (steps.length === 0 || status === "completed")) return null

  // The trailing Finish state: complete only when the run completes; failed or
  // cancelled runs stop short of it. While running it reads 'Up next' only when
  // the last real step is the in-progress one (its state is 'active' or, all
  // steps done and the run is finishing, 'completed'); otherwise it's 'pending'.
  const finishState: StepState =
    status === "completed"
      ? "completed"
      : status === "failed"
        ? "failed"
        : status === "cancelled"
          ? "skipped"
          : running &&
              (states[steps.length - 1] === "active" ||
                states[steps.length - 1] === "completed")
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
          <h2 className="text-sm font-semibold">{title ?? "Timeline"}</h2>
        </div>
        <div className="flex items-center gap-2">
          {deduced && iteration > 1 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs tabular-nums">
              Iteration {iteration}
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs tabular-nums">
            {completed}/{rows.length}
          </span>
        </div>
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
                    <p className="mt-1 truncate text-muted-foreground text-xs">
                      {row.detail ?? "Running…"}
                    </p>
                  )}
                  {state === "next" && row.pattern && (
                    <p className="mt-1 text-muted-foreground text-xs">
                      Waiting for <code>{row.pattern}</code> in the logs…
                    </p>
                  )}
                  {state === "failed" && (
                    <p className="mt-1 truncate text-destructive text-xs">
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
