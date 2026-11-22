import { FileUp, LoaderCircle } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { filePathOf } from "./lib/desktop"

const PACK_EXTENSION = ".cpgpack"

function packPaths(files: FileList | File[]): string[] {
  return Array.from(files)
    .filter((file) => file.name.toLowerCase().endsWith(PACK_EXTENSION))
    .map(filePathOf)
    .filter((target) => target.length > 0)
}

/**
 * True only when the drag carries at least one `.cpgpack` file. Inspects
 * `dataTransfer.items` (kind 'file') via each item's file name so we can
 * distinguish pack drags from ordinary file drags that must pass through to
 * children like the LocalFilePicker drop zone. If items are unavailable or
 * empty we return false and never block.
 */
function dragHasPack(event: DragEvent): boolean {
  const items = event.dataTransfer?.items
  if (!items || items.length === 0) return false
  return Array.from(items).some(
    (item) =>
      item.kind === "file" &&
      item.getAsFile()?.name.toLowerCase().endsWith(PACK_EXTENSION) === true,
  )
}

/**
 * A full-window drop target for `.cpgpack` files, mounted in the root route so
 * a pack can be imported from any page — not just the empty first-run one. The
 * overlay is purely visual; the drop itself is handled at the window level, so
 * it never blocks clicks or drags over the app's own content.
 */
export function PackDropOverlay() {
  const [depth, setDepth] = useState(0)
  const [busy, setBusy] = useState(false)
  const dragging = depth > 0

  const importDropped = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const paths = packPaths(files)
    if (paths.length === 0) {
      toast.error("Drop a .cpgpack file exported from a tool page")
      return
    }
    const bridge = window.cpgRunner
    if (!bridge) return
    setBusy(true)
    try {
      // The main process imports, then navigates to the added tool, so the
      // sidebar and tool list reload from the bridge on their own.
      await bridge.importPackPaths(paths)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    // `dragenter`/`dragleave` bubble from every element the pointer crosses,
    // so only count crossings of the window's own edge (`relatedTarget` is
    // null when leaving or entering the window), never element-to-element
    // moves, which would shake the overlay on and off.
    const onDragEnter = (event: DragEvent) => {
      if (!dragHasPack(event)) return
      if (event.relatedTarget) return
      event.preventDefault()
      setDepth((value) => value + 1)
    }
    const onDragOver = (event: DragEvent) => {
      if (dragHasPack(event)) event.preventDefault()
    }
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget) return
      setDepth((value) => Math.max(0, value - 1))
    }
    const onDrop = (event: DragEvent) => {
      // Mixed-drag choice: when the drag carries a pack the overlay wins and
      // imports it; any other files in the same drop reach the picker only
      // when no pack is present (the picker's own onDrop handles those).
      if (!dragHasPack(event)) return
      event.preventDefault()
      setDepth(0)
      void importDropped(event.dataTransfer?.files ?? null)
    }
    window.addEventListener("dragenter", onDragEnter)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onDragEnter)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("drop", onDrop)
    }
  }, [importDropped])

  if (!dragging && !busy) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="bg-background/80 absolute inset-0 backdrop-blur-sm" />
      <div className="relative flex max-w-sm flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-card p-8 text-center shadow-lg">
        {busy ? (
          <LoaderCircle className="size-8 animate-spin" />
        ) : (
          <FileUp className="size-8" />
        )}
        <p className="text-lg font-semibold">
          {busy ? "Adding tool…" : "Drop a .cpgpack to add a tool"}
        </p>
        <p className="text-muted-foreground text-sm">
          Installed here, replacing any tool with the same name and version.
        </p>
      </div>
    </div>
  )
}
