import { Ban, Check, CircleHelp, Clock, TriangleAlert } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { RunStatus } from "../../client"

const details: Record<RunStatus, { icon: React.ReactNode; label: string }> = {
  completed: {
    icon: <Check className="size-5 text-green-500" />,
    label: "Completed",
  },
  running: {
    icon: <Clock className="size-5 text-orange-400" />,
    label: "Running",
  },
  pending: {
    icon: <CircleHelp className="size-5 text-blue-500" />,
    label: "Pending",
  },
  failed: {
    icon: <TriangleAlert className="size-5 text-red-500" />,
    label: "Failed",
  },
  cancelled: {
    icon: <Ban className="size-5 text-gray-500" />,
    label: "Cancelled",
  },
}

const StatusIcon = ({ status }: { status: RunStatus }) => {
  const { icon, label } = details[status]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{icon}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export default StatusIcon
