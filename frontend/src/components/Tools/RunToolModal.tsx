import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react"
import RunToolForm from "./RunToolForm"

interface RunToolModalProps {
  isOpen: boolean
  onClose: () => void
  toolId: string
}
const RunToolModal = ({
  isOpen,
  onClose,
  toolId,
}: RunToolModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Configure Tool</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <RunToolForm toolId={toolId} onSuccess={onClose} />
        </ModalBody>
        <ModalFooter gap={3}>
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default RunToolModal
