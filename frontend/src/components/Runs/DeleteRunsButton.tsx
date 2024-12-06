import { Button, useDisclosure } from "@chakra-ui/react"
import DeleteAll from "../Common/DeleteAllAlert"

const DeleteRunsButton = () => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <Button
        onClick={onOpen}
        aria-label="Delete Runs"
        color="ui.danger"
        variant="outline"
      >
        Delete All
      </Button>
      <DeleteAll type="Runs" isOpen={isOpen} onClose={onClose} />
    </>
  )
}

export default DeleteRunsButton
