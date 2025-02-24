import { IconButton, Tooltip, useDisclosure } from "@chakra-ui/react"
import { FiX } from "react-icons/fi"
import Cancel from "./CancelAlert"

interface CancelButtonProps {
  run_id: string
  variant?: string
}

const CancelRunButton = ({ run_id, variant = 'outline' }: CancelButtonProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <Tooltip
          placement="top"
          hasArrow
          label="Cancel"
      >
        <IconButton
          onClick={onOpen}
          aria-label="Cancel Run"
          icon={<FiX fontSize="16px" />}
          variant={variant}
          size="sm"
        />
      </Tooltip>
      <Cancel id={run_id} isOpen={isOpen} onClose={onClose} />
    </>
  )
}

export default CancelRunButton
