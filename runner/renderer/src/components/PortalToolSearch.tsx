import { LoaderCircle, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import type { PortalToolSummary } from "../contracts"
import { placeholderImage } from "./ToolImage"

/**
 * The portal's catalogue, searched through the portal's own search so a tool
 * beyond the first page is found too. Picking a row leaves the version choice
 * to the caller's dialog.
 */
export function PortalToolSearch({
  onPick,
  className,
}: {
  onPick: (target: { name: string; version: string }) => void
  className?: string
}) {
  const [catalogue, setCatalogue] = useState<PortalToolSummary[]>([])
  // Null until the first search answers: the catalogue is shown meanwhile.
  const [results, setResults] = useState<PortalToolSummary[] | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading")
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState("")
  const searchSeq = useRef(0)

  useEffect(() => {
    let cancelled = false
    void window.cpgRunner
      ?.portalTools?.()
      .then((tools) => {
        if (cancelled) return
        setCatalogue(tools)
        setState("ready")
      })
      .catch(() => {
        if (!cancelled) setState("offline")
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
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
  }, [query])

  const shown = results ?? catalogue

  return (
    <div className={className}>
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
        />
      </div>

      <div className="mt-2 max-h-72 min-h-24 overflow-y-auto">
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
              ? `No portal tool matches “${query.trim()}”. The portal only lists the tools it has enabled.`
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
    </div>
  )
}
