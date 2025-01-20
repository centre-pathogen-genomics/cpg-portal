import { IconButton, useDisclosure } from "@chakra-ui/react"
import { FiX } from "react-icons/fi"
import Cancel from "./CancelAlert"

interface CancelButtonProps {
  run_id: string
}

const CancelRunButton = ({ run_id }: CancelButtonProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <IconButton
        onClick={onOpen}
        aria-label="Cancel Run"
        icon={<FiX fontSize="16px" />}
        // color="ui.dim"
        variant="outline"
        size="sm"
      />
      <Cancel id={run_id} isOpen={isOpen} onClose={onClose} />
    </>
  )
}

export default CancelRunButton
