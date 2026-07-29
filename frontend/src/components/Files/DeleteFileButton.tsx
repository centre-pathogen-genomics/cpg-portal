import { useState } from "react"
import { FiTrash2 } from "react-icons/fi"
import { Button } from "@/components/ui/button"
import type { FilePublic } from "../../client"
import Delete from "../Common/DeleteAlert"

interface DeleteButtonProps {
  file: FilePublic
}

const DeleteFileButton = ({ file }: DeleteButtonProps) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        aria-label="Delete File"
        variant="outline"
        size="icon-sm"
        className="hover:text-destructive"
      >
        <FiTrash2 className="size-4" />
      </Button>
      <Delete
        type="File"
        id={file.id}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}

export default DeleteFileButton
