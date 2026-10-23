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
  minCpus?: number | null
  maxCpus?: number | null
  defaultCpus?: number | null
}

const RunToolModal = ({
  isOpen,
  onClose,
  toolId,
  params,
  minCpus,
  maxCpus,
  defaultCpus,
}: RunToolModalProps) => (
  <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Configure Tool</DialogTitle>
      </DialogHeader>
      <RunToolForm
        toolId={toolId}
        params={params}
        onSuccess={onClose}
        minCpus={minCpus}
        maxCpus={maxCpus}
        defaultCpus={defaultCpus}
      />
      <DialogFooter>
        <Button onClick={onClose} variant="outline">
          Cancel
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

export default RunToolModal
