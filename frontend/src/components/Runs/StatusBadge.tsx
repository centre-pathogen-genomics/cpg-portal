import type { RunStatus } from "../../client"
import { Badge } from "@chakra-ui/react"

function StatusBadge({ status }: { status: RunStatus}) {
    const colorScheme = {
        "running": "blue",
        "failed": "red",
        "completed": "green",
        "pending": "purple",
        "cancelled": "gray",
    } 
    return (
        <Badge variant='outline'  colorScheme={colorScheme[status] || "teal"}>
            {status}
          </Badge>
    )
}
export default StatusBadge