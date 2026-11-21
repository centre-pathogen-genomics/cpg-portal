import { Check, Circle, History, LoaderCircle, Minus } from "lucide-react";
import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RunStatus, TimelineStep } from "../../client";

type StepState = "completed" | "active" | "next" | "pending" | "skipped";

const terminalStatuses = new Set(["completed", "failed", "cancelled"]);
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

const matches = (logs: string, pattern: string) => {
  try {
    return new RegExp(pattern, "i").test(logs);
  } catch {
    // A pattern that is not valid regex is still useful as plain text.
    return logs.toLowerCase().includes(pattern.toLowerCase());
  }
};

const stateLabel: Record<StepState, string> = {
  completed: "Done",
  active: "Running",
  next: "Up next",
  pending: "Waiting",
  skipped: "Missed",
};

const stateStyles: Record<StepState, string> = {
  completed:
    "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
  active:
    "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px] shadow-primary/15",
  next: "border-amber-500 bg-amber-400 text-amber-950 shadow-sm",
  pending: "border-border bg-muted text-muted-foreground",
  skipped: "border-dashed border-border bg-background text-muted-foreground",
};

const StepIcon = ({ state }: { state: StepState }) => {
  if (state === "completed") return <Check className="size-3.5" />;
  if (state === "active")
    return <LoaderCircle className="size-3.5 animate-spin" />;
  if (state === "skipped") return <Minus className="size-3.5" />;
  if (state === "next") return <Circle className="size-2.5 fill-current" />;
  return <Circle className="size-2.5 fill-current opacity-40" />;
};

interface RunTimelineProps {
  steps: TimelineStep[];
  logs: string;
  status: RunStatus;
  border?: boolean;
}

function RunTimeline({ steps, logs, status, border }: RunTimelineProps) {
  const cleanLogs = useMemo(() => logs.replace(ANSI_ESCAPE, ""), [logs]);
  const finished = terminalStatuses.has(status);
  const running = status === "running";
  const states = useMemo(() => {
    let activeIndex = -1;
    return steps.map<StepState>((step, index) => {
      if (activeIndex !== -1) {
        if (!finished && running && index === activeIndex + 1) return "next";
        return finished ? "skipped" : "pending";
      }
      if (matches(cleanLogs, step.pattern)) return "completed";
      activeIndex = index;
      return finished ? "skipped" : "active";
    });
  }, [cleanLogs, finished, running, steps]);

  // A completed run's timeline is just a row of ticks; the logs and results
  // are the useful part. Keep it for active runs, and for failed or cancelled
  // runs where it shows where the run stopped.
  if (steps.length === 0 || status === "completed") {
    return null;
  }

  const completed = states.filter((state) => state === "completed").length;

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
          <h2 className="text-sm font-semibold">Run timeline</h2>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs tabular-nums">
          {completed}/{steps.length}
        </span>
      </div>
      <ol>
        {steps.map((step, index) => {
          const state = states[index];
          const future = state === "pending" || state === "next";
          return (
            <li
              key={`${step.name}-${index}`}
              className="relative flex gap-3 pb-5 last:pb-0"
              aria-current={state === "active" ? "step" : undefined}
            >
              {index < steps.length - 1 && (
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          "cursor-help decoration-muted-foreground/50 underline-offset-4 hover:underline",
                          state === "active" || state === "next"
                            ? "font-semibold text-foreground"
                            : state === "completed"
                              ? "text-foreground"
                              : "text-muted-foreground",
                        )}
                      >
                        {step.name}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Pattern: <code>{step.pattern}</code>
                    </TooltipContent>
                  </Tooltip>
                  {state === "active" && (
                    <p className="mt-1 text-muted-foreground text-xs">
                      Waiting for <code>{step.pattern}</code> in the logs…
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
                    state === "pending" && "text-muted-foreground/60",
                    state === "skipped" && "text-muted-foreground/60",
                    future && "font-medium",
                  )}
                >
                  {stateLabel[state]}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default RunTimeline;
