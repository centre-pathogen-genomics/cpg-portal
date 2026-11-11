import { LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ToolSidebar } from "./components/ToolSidebar"
import { filePathOf, openExternal } from "./lib/desktop"

type ToolEntry = {
  id: string
  name: string
  version: string
  description: string | null
}

const PACK_EXTENSION = ".cpgpack"

function packPaths(files: FileList | File[]): string[] {
  return Array.from(files)
    .filter((file) => file.name.toLowerCase().endsWith(PACK_EXTENSION))
    .map(filePathOf)
    .filter((target) => target.length > 0)
}

function portalUrl(): string {
  const fromApp = window.cpgRunner?.portalUrl
  if (fromApp) return fromApp
  const configured = import.meta.env.VITE_CPG_PORTAL_URL
  return typeof configured === "string" ? configured : "http://localhost:8000"
}

/**
 * What the window shows before a tool is open: on a first run, the way to get
 * one. Choosing a tool afterwards happens in the sidebar.
 */
export function ToolsPage() {
  const bridge = window.cpgRunner
  const [tools, setTools] = useState<ToolEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const firstRun = tools.length === 0
  const portal = portalUrl()

  useEffect(() => {
    // The bridge is fixed for the window's lifetime.
    void window.cpgRunner?.tools().then(setTools)
  }, [])

  const importPacks = async (load: () => Promise<ToolEntry[]>) => {
    if (!bridge) return
    setBusy(true)
    try {
      const added = await load()
      if (added.length > 0) setTools(await bridge.tools())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const importDropped = (files: FileList) => {
    const paths = packPaths(files)
    if (paths.length === 0) {
      toast.error("Drop a .cpgpack file exported from a tool page")
      return
    }
    if (bridge) void importPacks(() => bridge.importPackPaths(paths))
  }

  return (
    <div className="flex h-full">
      <ToolSidebar activeToolId={null} />

      <main className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-8">
        <div className="bg-card w-full max-w-lg rounded-xl border p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">
            {firstRun ? "Add your first tool to get started" : "Choose a tool"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {firstRun
              ? "Pick a tool on the portal, download its pack, then open it here. Input files never leave this computer."
              : "Pick a tool on the left to run it on this computer."}
          </p>

          <div className="mt-6 grid gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => openExternal(portal)}
            >
              Open the portal
            </Button>

            <div
              className={`rounded-lg border border-dashed p-6 text-sm ${dragging ? "border-primary bg-muted" : "text-muted-foreground"}`}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                importDropped(event.dataTransfer.files)
              }}
            >
              <p>Drop a .cpgpack here</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                disabled={busy || !bridge}
                onClick={() =>
                  bridge && void importPacks(() => bridge.importPacks())
                }
              >
                {busy ? <LoaderCircle className="animate-spin" /> : null}
                {busy ? "Adding tool…" : "or choose a file"}
              </Button>
              {busy && (
                <p className="mt-1 text-xs">
                  Reading the pack and starting its runner…
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
