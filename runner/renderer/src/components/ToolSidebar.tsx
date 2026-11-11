import { LoaderCircle, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PortalToolSummary } from "../contracts"
import { PortalToolDialog } from "./PortalToolDialog"
import { ToolImage, placeholderImage, useToolImages } from "./ToolImage"

type ToolEntry = {
  id: string
  name: string
  version: string
  description: string | null
}

/**
 * The tools this computer has, then the ones the portal offers. The former are
 * a workspace list; the latter are one click from being installed.
 */
export function ToolSidebar({
  activeToolId,
  beforeOpen,
}: {
  activeToolId?: string | null
  /** Asked before a tool is opened; false leaves the click to the caller. */
  beforeOpen?: (toolId: string) => boolean | Promise<boolean>
}) {
  const bridge = window.cpgRunner
  const images = useToolImages()
  const [tools, setTools] = useState<ToolEntry[]>([])
  const [portalTools, setPortalTools] = useState<PortalToolSummary[]>([])
  const [portalState, setPortalState] = useState<"loading" | "ready" | "offline">(
    "loading",
  )
  const [portalTarget, setPortalTarget] = useState<{
    name: string
    version: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)

  useEffect(() => {
    // The bridge is fixed for the window's lifetime.
    void window.cpgRunner?.tools().then(setTools)
    void window.cpgRunner
      ?.portalTools?.()
      .then((catalogue) => {
        setPortalTools(catalogue)
        setPortalState("ready")
      })
      .catch(() => setPortalState("offline"))
  }, [])

  async function openTool(toolId: string) {
    if (!bridge || openingId) return
    if (beforeOpen && !(await beforeOpen(toolId))) return
    setOpeningId(toolId)
    try {
      // Resolves once the tool's page has loaded; the row spins meanwhile.
      await bridge.openTool(toolId)
    } finally {
      setOpeningId(null)
    }
  }

  async function addTool() {
    if (!bridge) return
    setBusy(true)
    try {
      const added = await bridge.importPacks()
      if (added.length > 0) setTools(await bridge.tools())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="bg-muted/40 flex w-56 shrink-0 flex-col border-r">
      <div className="px-4 py-4">
        <p className="text-sm font-semibold tracking-tight">CPG Runner</p>
        <p className="text-muted-foreground text-xs">Runs on this computer</p>
      </div>

      <nav aria-label="Tools" className="min-h-0 flex-1 overflow-y-auto px-2">
        <p className="text-muted-foreground px-2 pt-1 pb-1 text-xs font-semibold tracking-wide uppercase">
          My tools
        </p>
        {tools.length === 0 ? (
          <p className="text-muted-foreground px-2 py-2 text-xs">
            No tools yet. Add one below, or pick one from the portal.
          </p>
        ) : (
          <ul className="grid gap-0.5">
            {tools.map((tool) => {
              const active = tool.id === activeToolId
              return (
                <li key={tool.id}>
                  <button
                    type="button"
                    onClick={() => void openTool(tool.id)}
                    aria-current={active ? "page" : undefined}
                    disabled={openingId !== null}
                    title={tool.description ?? tool.name}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      active
                        ? "bg-background font-medium shadow-sm"
                        : "hover:bg-background/70",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ToolImage
                        id={tool.id}
                        name={tool.name}
                        images={images}
                        className="size-5"
                      />
                      <span className="truncate">{tool.name}</span>
                    </span>
                    {openingId === tool.id ? (
                      <LoaderCircle className="text-muted-foreground size-3.5 shrink-0 animate-spin" />
                    ) : (
                      tool.version && (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {tool.version}
                        </span>
                      )
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <p className="text-muted-foreground mt-4 px-2 pt-1 pb-1 text-xs font-semibold tracking-wide uppercase">
          CPG Portal tools
        </p>
        {portalState === "loading" && (
          <p className="text-muted-foreground flex items-center gap-2 px-2 py-2 text-xs">
            <LoaderCircle className="size-3.5 animate-spin" />
            Reading the portal…
          </p>
        )}
        {portalState === "offline" && (
          <p className="text-muted-foreground px-2 py-2 text-xs">
            The portal is not reachable right now.
          </p>
        )}
        {portalState === "ready" && (
          <ul className="grid gap-0.5">
            {portalTools.map((tool) => (
              <li key={`${tool.name}-${tool.version}`}>
                <button
                  type="button"
                  onClick={() =>
                    setPortalTarget({
                      name: tool.name,
                      version: tool.version,
                    })
                  }
                  title={tool.description ?? tool.name}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-background/70"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <img
                      src={tool.image ?? placeholderImage(tool.name)}
                      alt={tool.name}
                      className="size-5 shrink-0 rounded-md border object-cover"
                    />
                    <span className="truncate">{tool.name}</span>
                  </span>
                  {tool.version && (
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {tool.version}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="grid gap-1 border-t p-2">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start"
          disabled={busy || openingId !== null || !bridge}
          onClick={() => void addTool()}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <Plus />}
          {busy ? "Adding tool…" : "Add tool"}
        </Button>
        {busy && (
          <p className="text-muted-foreground px-2 pb-1 text-xs">
            Reading the pack and starting its runner…
          </p>
        )}
      </div>

      <PortalToolDialog
        target={portalTarget}
        installed={tools}
        onOpenChange={(open) => {
          if (!open) setPortalTarget(null)
        }}
      />
    </aside>
  )
}
