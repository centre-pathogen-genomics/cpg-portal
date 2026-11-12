import { FileUp, LoaderCircle, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
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
import { Input } from "@/components/ui/input"
import type { PortalToolSummary } from "../contracts"
import { placeholderImage } from "./ToolImage"

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
  const [catalogue, setCatalogue] = useState<PortalToolSummary[]>([])
  // Null until the first search answers: the catalogue is shown meanwhile.
  const [results, setResults] = useState<PortalToolSummary[] | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading")
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState("")
  const [importing, setImporting] = useState(false)
  const searchSeq = useRef(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setQuery("")
    setResults(null)
    setState("loading")
    void window.cpgRunner
      ?.portalTools?.()
      .then((catalogue) => {
        if (cancelled) return
        setCatalogue(catalogue)
        setState("ready")
      })
      .catch(() => {
        if (!cancelled) setState("offline")
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // The catalogue is one page; a query goes to the portal's search, which
  // covers every tool it hosts.
  useEffect(() => {
    if (!open) return
    const needle = query.trim()
    const seq = ++searchSeq.current
    if (!needle) {
      setResults(null)
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      void window.cpgRunner
        ?.portalSearch?.(needle)
        .then((found) => {
          if (seq !== searchSeq.current) return
          setResults(found)
          setState("ready")
        })
        .catch(() => {
          if (seq === searchSeq.current) setState("offline")
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false)
        })
    }, 250)
    return () => clearTimeout(timer)
  }, [open, query])

  const shown = results ?? catalogue

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

        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-4" />
          {searching && (
            <LoaderCircle className="text-muted-foreground absolute top-2.5 right-2.5 size-4 animate-spin" />
          )}
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the portal"
            aria-label="Search the portal tools"
            className="pl-8"
            autoFocus
          />
        </div>

        <div className="max-h-80 min-h-24 overflow-y-auto">
          {state === "loading" && (
            <p className="text-muted-foreground flex items-center gap-2 px-2 py-3 text-sm">
              <LoaderCircle className="animate-spin" />
              Reading the portal…
            </p>
          )}
          {state === "offline" && (
            <p className="text-muted-foreground px-2 py-3 text-sm">
              The portal is not reachable right now.
            </p>
          )}
          {state === "ready" && shown.length === 0 && (
            <p className="text-muted-foreground px-2 py-3 text-sm">
              {query.trim()
                ? `No portal tool matches “${query.trim()}”.`
                : "The portal lists no tools."}
            </p>
          )}
          {state === "ready" && shown.length > 0 && (
            <ul className="grid grid-cols-1 gap-0.5">
              {shown.map((tool) => (
                <li key={`${tool.name}-${tool.version}`} className="min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      onPick({ name: tool.name, version: tool.version })
                    }
                    title={tool.description ?? tool.name}
                    className="hover:bg-muted flex w-full items-center gap-3 rounded-md px-2 py-2 text-left"
                  >
                    <img
                      src={tool.image ?? placeholderImage(tool.name)}
                      alt=""
                      className="size-8 shrink-0 rounded-md border object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium">
                          {tool.name}
                        </span>
                        {tool.version && (
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {tool.version}
                          </span>
                        )}
                      </span>
                      {tool.description && (
                        <span className="text-muted-foreground block truncate text-xs">
                          {tool.description}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="mt-2 gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={() => void addFromFile()}
          >
            {importing ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <FileUp />
            )}
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
