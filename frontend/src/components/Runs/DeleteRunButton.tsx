import { IconButton, Tooltip, useDisclosure } from "@chakra-ui/react"
import { FiTrash2 } from "react-icons/fi"
import Delete from "../Common/DeleteAlert"

interface DeleteButtonProps {
  run_id: string
  variant?: string
  onDelete?: () => void
}

const DeleteRunButton = ({ run_id, onDelete, variant="outline" }: DeleteButtonProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <Tooltip
          placement="top"
          hasArrow
          label="Delete"
      >
        <IconButton
          onClick={onOpen}
          aria-label="Delete Run"
          icon={<FiTrash2 fontSize="16px" />}
          _hover={{ color: "ui.danger" }}
          variant={variant}
          size="sm"
        />
        </Tooltip>
        <Delete type="Run" id={run_id} isOpen={isOpen} onClose={onClose} onDelete={onDelete} />
      
    </>
  )
}

export default DeleteRunButton
