import { Button, useDisclosure } from "@chakra-ui/react"
import DeleteAll from "../Common/DeleteAllAlert"

const DeleteTasksButton = () => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <Button
        onClick={onOpen}
        aria-label="Delete Files"
        color="ui.danger"
        variant="outline"
      >
        Delete All
      </Button>
      <DeleteAll type="Files" isOpen={isOpen} onClose={onClose} />
    </>
  )
}

export default DeleteTasksButton
