import { useState } from "react"
import { Button } from "@/components/ui/button"
import CancelAll from "./CancelAllAlert"

const CancelRunButton = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        aria-label="Cancel Runs"
        variant="secondary"
      >
        Cancel All
      </Button>
      <CancelAll isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}

export default CancelRunButton
