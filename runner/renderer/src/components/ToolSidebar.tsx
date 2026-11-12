import { LoaderCircle, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AddToolDialog } from "./AddToolDialog"
import { PortalToolDialog } from "./PortalToolDialog"
import { ToolImage, useToolImages } from "./ToolImage"

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
 * The tools this computer has. Adding one — from the portal or from a pack —
 * goes through the Add tool dialog. It folds to an icon bar, which is
 * remembered for the window and across launches.
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
  const [addOpen, setAddOpen] = useState(false)
  const [portalTarget, setPortalTarget] = useState<{
    name: string
    version: string
  } | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  useEffect(() => {
    // The bridge is fixed for the window's lifetime.
    void window.cpgRunner?.tools().then(setTools)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "collapsed" : "expanded")
    } catch {
      // A window that refuses storage simply forgets the choice.
    }
  }, [collapsed])

  async function refreshTools() {
    if (!bridge) return
    setTools(await bridge.tools())
  }

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
          !collapsed && (
            <p className="text-muted-foreground px-2 py-2 text-xs">
              No tools yet. Add one below.
            </p>
          )
        ) : (
          <ul className="grid grid-cols-1 gap-0.5">
            {tools.map((tool) => {
              const active = tool.id === activeToolId
              return (
                <li key={tool.id} className="min-w-0">
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
      </nav>

      <div className="grid gap-1 border-t p-2">
        <Button
          type="button"
          variant="ghost"
          className={cn("w-full", collapsed ? "justify-center" : "justify-start")}
          disabled={openingId !== null || !bridge}
          title={collapsed ? "Add tool" : undefined}
          aria-label={collapsed ? "Add tool" : undefined}
          onClick={() => setAddOpen(true)}
        >
          <Plus />
          {!collapsed && "Add tool"}
        </Button>
      </div>

      <AddToolDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onPick={(target) => {
          setAddOpen(false)
          setPortalTarget(target)
        }}
        onAdded={() => void refreshTools()}
      />

      <PortalToolDialog
        target={portalTarget}
        installed={tools}
        onOpenChange={(open) => {
          if (!open) setPortalTarget(null)
        }}
        onAdded={() => void refreshTools()}
      />
    </aside>
  )
}
