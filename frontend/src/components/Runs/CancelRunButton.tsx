import { useState } from "react"
import { FiX } from "react-icons/fi"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import Cancel from "./CancelAlert"

interface CancelButtonProps {
  run_id: string
  variant?: string
}

const CancelRunButton = ({
  run_id,
  variant = "outline",
}: CancelButtonProps) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => setIsOpen(true)}
            aria-label="Cancel Run"
            variant={variant === "outline" ? "outline" : "default"}
            size="icon-sm"
          >
            <FiX className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Cancel</TooltipContent>
      </Tooltip>
      <Cancel id={run_id} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}

export default CancelRunButton
