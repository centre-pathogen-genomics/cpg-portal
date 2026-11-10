import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { RunStatus } from "../contracts"

const STATUS_CLASSES: Record<RunStatus, string> = {
  pending: "border-transparent bg-secondary text-secondary-foreground",
  running: "border-transparent bg-primary text-primary-foreground",
  completed:
    "border-transparent bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
  failed: "border-transparent bg-destructive text-white",
  cancelled: "text-foreground",
}

export function StatusPill({
  status,
  className,
}: {
  status: RunStatus
  className?: string
}) {
  return (
    <Badge className={cn("capitalize", STATUS_CLASSES[status], className)}>
      {status}
    </Badge>
  )
}
