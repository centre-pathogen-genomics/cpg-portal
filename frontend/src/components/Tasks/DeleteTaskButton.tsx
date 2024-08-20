import { IconButton, useDisclosure } from "@chakra-ui/react"
import { FiTrash2 } from "react-icons/fi"
import type { TaskPublic } from "../../client"
import Delete from "../Common/DeleteAlert"

interface DeleteButtonProps {
  task: TaskPublic
}

const DeleteTaskButton = ({ task }: DeleteButtonProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <IconButton
        onClick={onOpen}
        aria-label="Delete Task"
        icon={<FiTrash2 fontSize="16px" />}
        color="ui.danger"
        variant="outline"
        size="sm"
      />
      <Delete type="Task" id={task.id} isOpen={isOpen} onClose={onClose} />
    </>
  )
}

export default DeleteTaskButton
