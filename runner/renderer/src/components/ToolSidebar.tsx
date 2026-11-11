import { LoaderCircle, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react"
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

const COLLAPSED_KEY = "cpg-runner.sidebar"

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "collapsed"
  } catch {
    return false
  }
}

/**
 * The tools this computer has, then the ones the portal offers. The former are
 * a workspace list; the latter are one click from being installed. It folds to
 * an icon bar, which is remembered for the window and across launches.
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
  const [collapsed, setCollapsed] = useState(readCollapsed)
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

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "collapsed" : "expanded")
    } catch {
      // A window that refuses storage simply forgets the choice.
    }
  }, [collapsed])

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
    <aside
      className={cn(
        "bg-muted/40 flex shrink-0 flex-col border-r",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 py-4",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight">
              CPG Runner
            </p>
            <p className="text-muted-foreground truncate text-xs">
              Runs on this computer
            </p>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-7 shrink-0"
          aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      <nav
        aria-label="Tools"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2"
      >
        {!collapsed && (
          <p className="text-muted-foreground px-2 pt-1 pb-1 text-xs font-semibold tracking-wide uppercase">
            My tools
          </p>
        )}
        {tools.length === 0 ? (
          <p className="text-muted-foreground px-2 py-2 text-xs">
            No tools yet. Add one below, or pick one from the portal.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-0.5">
            {tools.map((tool) => {
              const active = tool.id === activeToolId
              return (
                <li key={tool.id}>
                  <button
                    type="button"
                    onClick={() => void openTool(tool.id)}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? tool.name : undefined}
                    disabled={openingId !== null}
                    title={tool.description ?? tool.name}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      collapsed ? "justify-center" : "justify-between",
                      active
                        ? "bg-background font-medium shadow-sm"
                        : "hover:bg-background/70",
                    )}
                  >
                    <span
                      className={cn(
                        "flex min-w-0 items-center gap-2",
                        !collapsed && "flex-1",
                      )}
                    >
                      {collapsed && openingId === tool.id ? (
                        <LoaderCircle className="text-muted-foreground size-4 shrink-0 animate-spin" />
                      ) : (
                        <ToolImage
                          id={tool.id}
                          name={tool.name}
                          images={images}
                          className="size-5"
                        />
                      )}
                      {!collapsed && (
                        <span className="truncate">{tool.name}</span>
                      )}
                    </span>
                    {!collapsed &&
                      (openingId === tool.id ? (
                        <LoaderCircle className="text-muted-foreground size-3.5 shrink-0 animate-spin" />
                      ) : (
                        tool.version && (
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {tool.version}
                          </span>
                        )
                      ))}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {!collapsed && (
          <p className="text-muted-foreground mt-4 px-2 pt-1 pb-1 text-xs font-semibold tracking-wide uppercase">
            CPG Portal tools
          </p>
        )}
        {collapsed && portalState === "ready" && portalTools.length > 0 && (
          <div className="bg-border mx-1 my-2 h-px" />
        )}
        {portalState === "loading" && (
          <p className="text-muted-foreground flex items-center gap-2 px-2 py-2 text-xs">
            <LoaderCircle className="size-3.5 animate-spin" />
            {!collapsed && "Reading the portal…"}
          </p>
        )}
        {portalState === "offline" && (
          <p className="text-muted-foreground px-2 py-2 text-xs">
            {collapsed ? "—" : "The portal is not reachable right now."}
          </p>
        )}
        {portalState === "ready" && (
          <ul className="grid grid-cols-1 gap-0.5">
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
                  aria-label={collapsed ? tool.name : undefined}
                  title={tool.description ?? tool.name}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-background/70",
                    collapsed ? "justify-center" : "justify-between",
                  )}
                >
                  <span
                    className={cn(
                      "flex min-w-0 items-center gap-2",
                      !collapsed && "flex-1",
                    )}
                  >
                    <img
                      src={tool.image ?? placeholderImage(tool.name)}
                      alt={collapsed ? "" : tool.name}
                      className="size-5 shrink-0 rounded-md border object-cover"
                    />
                    {!collapsed && (
                      <span className="truncate">{tool.name}</span>
                    )}
                  </span>
                  {!collapsed && tool.version && (
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
          className={cn("w-full", collapsed ? "justify-center" : "justify-start")}
          disabled={busy || openingId !== null || !bridge}
          title={collapsed ? (busy ? "Adding tool…" : "Add tool") : undefined}
          aria-label={collapsed ? (busy ? "Adding tool" : "Add tool") : undefined}
          onClick={() => void addTool()}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <Plus />}
          {!collapsed && (busy ? "Adding tool…" : "Add tool")}
        </Button>
        {busy && !collapsed && (
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
