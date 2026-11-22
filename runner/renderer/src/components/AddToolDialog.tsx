import { FileUp, LoaderCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PortalToolSearch } from "./PortalToolSearch"

/**
 * Where tools come from: the portal's catalogue, searched by name, or a
 * `.cpgpack` picked from this computer. Adding either one opens the tool.
 */
export function AddToolDialog({
  open,
  onOpenChange,
  onPick,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A portal tool was chosen: its own dialog asks for the version. */
  onPick: (target: { name: string; version: string }) => void
  /** A pack was imported; the sidebar reloads its list with these names. */
  onAdded?: (names: string[]) => void
}) {
  const [importing, setImporting] = useState(false)

  async function addFromFile() {
    const bridge = window.cpgRunner
    if (!bridge) return
    setImporting(true)
    try {
      const added = await bridge.importPacks()
      if (added.length > 0) {
        onAdded?.(added.map((tool) => tool.name))
        onOpenChange(false)
      }
    } catch (error) {
      toast.error(String(error).replace(/^Error: /, ""))
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a tool</DialogTitle>
          <DialogDescription>
            Pick one from the portal, or load a pack from this computer.
          </DialogDescription>
        </DialogHeader>

        <PortalToolSearch onPick={onPick} />

        <DialogFooter className="mt-2 gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={() => void addFromFile()}
          >
            {importing ? <LoaderCircle className="animate-spin" /> : <FileUp />}
            {importing ? "Reading the pack…" : "Add tool from file system"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
