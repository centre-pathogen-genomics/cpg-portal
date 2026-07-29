import { LoaderCircle } from "lucide-react"
import type { FormEvent, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending = false,
  onConfirm,
}: ConfirmationDialogProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div>{description}</div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              {confirmLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
