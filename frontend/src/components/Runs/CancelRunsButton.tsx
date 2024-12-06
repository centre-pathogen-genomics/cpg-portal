import { Button, useDisclosure } from "@chakra-ui/react"
import CancelAll from "./CancelAllAlert"

const CancelRunButton = () => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <Button
        onClick={onOpen}
        aria-label="Cancel Run"
        color="ui.dim"
      >
        Cancel All
      </Button>
      <CancelAll isOpen={isOpen} onClose={onClose} />
    </>
  )
}

export default CancelRunButton
