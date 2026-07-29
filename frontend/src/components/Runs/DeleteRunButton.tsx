import { useState } from "react"
import { FiTrash2 } from "react-icons/fi"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import Delete from "../Common/DeleteAlert"

interface DeleteButtonProps {
  run_id: string
  variant?: string
  onDelete?: () => void
}

const DeleteRunButton = ({
  run_id,
  onDelete,
  variant = "outline",
}: DeleteButtonProps) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => setIsOpen(true)}
            aria-label="Delete Run"
            variant={variant === "outline" ? "outline" : "default"}
            size="icon-sm"
            className="hover:text-destructive"
          >
            <FiTrash2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
      <Delete
        type="Run"
        id={run_id}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onDelete={onDelete}
      />
    </>
  )
}

export default DeleteRunButton
