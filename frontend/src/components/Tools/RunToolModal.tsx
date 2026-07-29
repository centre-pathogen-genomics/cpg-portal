import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from "@/components/ui/chakra-compat"
import type { Param } from "../../client"
import RunToolForm from "./RunToolForm"

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
        <ModalHeader>
          <Text as={"b"}>Configure Tool</Text>
        </ModalHeader>
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
