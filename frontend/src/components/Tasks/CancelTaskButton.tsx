import { IconButton, useDisclosure } from "@chakra-ui/react"
import { FiX } from "react-icons/fi"
import Cancel from "./CancelAlert"

interface CancelButtonProps {
  task_id: string
}

const CancelTaskButton = ({ task_id }: CancelButtonProps) => {
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
      <Cancel id={task_id} isOpen={isOpen} onClose={onClose} />
    </>
  )
}

export default CancelTaskButton
