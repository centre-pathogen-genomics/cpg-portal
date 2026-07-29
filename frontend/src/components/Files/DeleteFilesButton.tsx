import { useState } from "react"
import { Button } from "@/components/ui/button"
import DeleteAll from "../Common/DeleteAllAlert"

const DeleteRunsButton = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        aria-label="Delete Files"
        variant="outline"
        className="text-destructive hover:text-destructive"
      >
        Delete All
      </Button>
      <DeleteAll
        type="Files"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}

export default DeleteRunsButton
