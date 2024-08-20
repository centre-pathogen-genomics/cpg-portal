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
import RunWorkflowForm from "./RunWorkflowForm"

interface RunWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  workflowId: number
}
const RunWorkflowModal = ({
  isOpen,
  onClose,
  workflowId,
}: RunWorkflowModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Configure Workflow</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <RunWorkflowForm workflowId={workflowId} onSuccess={onClose} />
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

export default RunWorkflowModal
