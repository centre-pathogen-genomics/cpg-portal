import { IconButton, useDisclosure } from "@chakra-ui/react"
import { FiTrash2 } from "react-icons/fi"
import Delete from "../Common/DeleteAlert"

interface DeleteButtonProps {
  run_id: string
}

const DeleteRunButton = ({ run_id }: DeleteButtonProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <IconButton
        onClick={onOpen}
        aria-label="Delete Run"
        icon={<FiTrash2 fontSize="16px" />}
        color="ui.danger"
        variant="outline"
        size="sm"
      />
      <Delete type="Run" id={run_id} isOpen={isOpen} onClose={onClose} />
    </>
  )
}

export default DeleteRunButton
