import React from "react"
import { Button, useDisclosure } from "@chakra-ui/react"
import DeleteAll from "../Common/DeleteAllAlert"

const DeleteTasksButton = () => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <Button
        onClick={onOpen}
        aria-label="Delete Tasks"
        color="ui.danger"
        variant="outline"
      >
        Delete All
      </Button>
      <DeleteAll type="Tasks" isOpen={isOpen} onClose={onClose} />
    </>
  )
}

export default DeleteTasksButton
