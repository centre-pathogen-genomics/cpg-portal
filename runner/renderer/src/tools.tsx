import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { filePathOf } from "./lib/desktop"
import { navigate } from "./router"

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

export function ToolsPage() {
  const bridge = window.cpgRunner
  const [tools, setTools] = useState<ToolEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    void bridge?.tools().then(setTools)
  }, [bridge])

  const runImport = async (importPacks: () => Promise<ToolEntry[]>) => {
    if (!bridge) return
    setBusy(true)
    try {
      const added = await importPacks()
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
    if (bridge) void runImport(() => bridge.importPackPaths(paths))
  }

  const importFromDialog = () => {
    if (bridge) void runImport(() => bridge.importPacks())
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b px-8 py-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold">CPG Runner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tools installed on this computer. Each one runs in Docker and keeps
            its files here.
          </p>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto grid max-w-3xl gap-6">
          {tools.length > 0 ? (
            <ul className="grid gap-3">
              {tools.map((tool) => (
                <li
                  key={tool.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{tool.name}</span>
                      {tool.version && (
                        <span className="text-sm text-muted-foreground">
                          v{tool.version}
                        </span>
                      )}
                    </div>
                    {tool.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {tool.description}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void bridge?.openTool(tool.id)}
                  >
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tools yet. Download one from a tool page on the portal: choose
              <span className="font-medium"> Run locally</span>, then
              <span className="font-medium"> Download tool pack</span>.
            </p>
          )}

          <div
            className={`rounded-lg border border-dashed p-6 text-center text-sm ${dragging ? "border-primary bg-muted" : "text-muted-foreground"}`}
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
            <p>Drop a .cpgpack here to add or update a tool.</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || !bridge}
                onClick={importFromDialog}
              >
                Import tool pack
              </Button>
              {tools.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate("/tool")}
                >
                  Back to tool
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="shrink-0 border-t px-8 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Packs are a few kilobytes; the app and its runtime image are shared.
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => window.close()}
          >
            Quit
          </Button>
        </div>
      </footer>
    </div>
  )
}
