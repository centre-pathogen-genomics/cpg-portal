import { IconButton, useDisclosure } from "@chakra-ui/react"
import { FiX } from "react-icons/fi"
import type { TaskPublic } from "../../client"
import Cancel from "./CancelAlert"

interface CancelButtonProps {
  task: TaskPublic
}

const CancelTaskButton = ({ task }: CancelButtonProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <IconButton
        onClick={onOpen}
        aria-label="Cancel Task"
        icon={<FiX fontSize="16px" />}
        color="ui.dim"
        variant="outline"
        size="sm"
      />
      <Cancel id={task.id} isOpen={isOpen} onClose={onClose} />
    </>
  )
}

export default CancelTaskButton
