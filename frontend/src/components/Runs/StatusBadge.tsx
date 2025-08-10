import type { RunStatus } from "../../client"
import { Badge, Icon, Spinner } from "@chakra-ui/react"
import { HiCheckCircle, HiXCircle } from "react-icons/hi"
import { MdSchedule, MdCancel } from "react-icons/md"

function StatusBadge({ status }: { status: RunStatus}) {
    const colorScheme = {
        "running": "blue",
        "failed": "red",
        "completed": "green",
        "pending": "purple",
        "cancelled": "gray",
    } 
    const iconForStatus = {
        running: <Spinner boxSize="0.9em" />,
        failed: <Icon as={HiXCircle} boxSize="0.95em" />,
        completed: <Icon as={HiCheckCircle} boxSize="0.95em" />,
        pending: <Icon as={MdSchedule} boxSize="0.95em" />,
        cancelled: <Icon as={MdCancel} boxSize="0.95em" />,
    } as const
    return (
        <Badge
            variant='outline'
            px={1}
            colorScheme={colorScheme[status] || "teal"}
            display="inline-flex"
            alignItems="center"
            gap={1}
        >
            {iconForStatus[status]}
            {status}
          </Badge>
    )
}
export default StatusBadge