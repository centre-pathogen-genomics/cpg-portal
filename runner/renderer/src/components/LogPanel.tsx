import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export function LogPanel({
  lines,
  className,
}: {
  lines: string[]
  className?: string
}) {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    // New lines are the trigger; the effect itself only scrolls the panel.
    // biome-ignore lint/correctness/useExhaustiveDependencies: follows the log
    const node = ref.current
    if (node) node.scrollTop = node.scrollHeight
  }, [lines])

  return (
    <pre
      ref={ref}
      className={cn(
        "bg-muted h-64 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap",
        className,
      )}
    >
      {lines.join("\n")}
    </pre>
  )
}
