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
import { Param } from "../../client"

interface RunToolModalProps {
  isOpen: boolean
  onClose: () => void
  toolId: string
  params: Param[]
}
const RunToolModal = ({
  isOpen,
  onClose,
  toolId,
  params,

}: RunToolModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent maxWidth={"2xl"}>
        <ModalHeader>Configure Tool</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <RunToolForm toolId={toolId} params={params} onSuccess={onClose} />
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
