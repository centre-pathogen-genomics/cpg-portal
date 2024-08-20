import {
  CheckIcon,
  NotAllowedIcon,
  QuestionOutlineIcon,
  TimeIcon,
  WarningIcon,
} from "@chakra-ui/icons"
import { Tooltip } from "@chakra-ui/react"
import type { TaskStatus } from "../../client"

const StatusIcon = ({ status }: { status: TaskStatus }) => {
  const getIconDetails = (status: TaskStatus) => {
    switch (status) {
      case "completed":
        return {
          icon: <CheckIcon boxSize={5} color="green.500" />,
          label: "Completed",
        }
      case "running":
        return {
          icon: <TimeIcon boxSize={5} color="orange.400" />,
          label: "Running",
        }
      case "pending":
        return {
          icon: <QuestionOutlineIcon boxSize={5} color="blue.500" />,
          label: "Pending",
        }
      case "failed":
        return {
          icon: <WarningIcon boxSize={5} color="red.500" />,
          label: "Failed",
        }
      case "cancelled":
        return {
          icon: <NotAllowedIcon boxSize={5} color="gray.500" />,
          label: "Cancelled",
        }
      default:
        return {
          icon: <QuestionOutlineIcon boxSize={5} color="gray.300" />,
          label: "Unknown",
        } // Fallback for unknown statuses
    }
  }

  const { icon, label } = getIconDetails(status)

  return (
    <Tooltip placement="top" hasArrow label={label} bg="gray.300" color="black">
      {icon}
    </Tooltip>
  )
}

export default StatusIcon
