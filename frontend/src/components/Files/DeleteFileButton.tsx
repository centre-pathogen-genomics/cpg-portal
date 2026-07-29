import { IconButton, useDisclosure } from "@chakra-ui/react"
import { FiTrash2 } from "react-icons/fi"
import type { FilePublic } from "../../client"
import Delete from "../Common/DeleteAlert"

interface DeleteButtonProps {
  file: FilePublic
}

const DeleteFileButton = ({ file }: DeleteButtonProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <IconButton
        onClick={onOpen}
        aria-label="Delete Run"
        icon={<FiTrash2 fontSize="16px" />}
        _hover={{ color: "ui.danger" }}
        variant="outline"
        size="sm"
      />
      <Delete type="File" id={file.id} isOpen={isOpen} onClose={onClose} />
    </>
  )
}

export default DeleteFileButton
