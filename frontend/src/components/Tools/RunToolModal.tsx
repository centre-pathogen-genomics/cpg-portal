import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
}: RunToolModalProps) => (
  <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Configure Tool</DialogTitle>
      </DialogHeader>
      <RunToolForm toolId={toolId} params={params} onSuccess={onClose} />
      <DialogFooter>
        <Button onClick={onClose} variant="outline">
          Cancel
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

export default RunToolModal
