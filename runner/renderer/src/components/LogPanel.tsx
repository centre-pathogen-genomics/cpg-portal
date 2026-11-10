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
