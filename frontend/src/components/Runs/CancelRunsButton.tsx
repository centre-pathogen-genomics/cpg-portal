import { Button, useDisclosure } from "@/components/ui/chakra-compat"
import CancelAll from "./CancelAllAlert"

const CancelRunButton = () => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <Button onClick={onOpen} aria-label="Cancel Run" color="ui.dim">
        Cancel All
      </Button>
      <CancelAll isOpen={isOpen} onClose={onClose} />
    </>
  )
}

export default CancelRunButton
