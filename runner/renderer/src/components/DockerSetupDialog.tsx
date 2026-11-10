import { useState } from "react"
import { toast } from "sonner"
import RenderMarkdown from "@/components/Common/Markdown"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api, errorMessage } from "../api"
import { openExternal } from "../lib/desktop"
import type { DoctorReport } from "../contracts"
import { LogPanel } from "./LogPanel"

function fencedCommands(markdown: string): string[] {
  const commands: string[] = []
  const fence = /```[^\n]*\n([\s\S]*?)```/g
  let match = fence.exec(markdown)
  while (match) {
    const command = match[1].trim()
    if (command) commands.push(command)
    match = fence.exec(markdown)
  }
  return commands
}

export function DockerSetupDialog({
  open,
  doctor,
  onRefresh,
}: {
  open: boolean
  doctor: DoctorReport | null
  onRefresh: () => void
}) {
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [lines, setLines] = useState<string[]>([])

  if (!doctor) return null

  const commands = fencedCommands(doctor.instructions)

  async function runAction(actionId: string) {
    if (activeAction) return
    setActiveAction(actionId)
    setLines([])
    try {
      await api.post(`/doctor/actions/${encodeURIComponent(actionId)}`)
    } catch (error) {
      toast.error(errorMessage(error))
      setActiveAction(null)
      return
    }
    const events = new EventSource(api.doctorEventsUrl())
    events.onmessage = (event) => {
      setLines((previous) => [...previous, String(event.data)].slice(-500))
    }
    events.addEventListener("done", () => {
      events.close()
      setActiveAction(null)
      onRefresh()
    })
    events.onerror = () => {
      if (events.readyState !== EventSource.CLOSED) return
      setActiveAction(null)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Set up Docker</DialogTitle>
          <DialogDescription>
            CPG Runner runs tools with Docker on this computer.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-4 overflow-auto pr-1">
          <RenderMarkdown markdown={doctor.instructions} />
          {commands.map((command, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: identical commands may repeat
              key={`${index}-${command}`}
              className="rounded-md border"
            >
              <pre className="overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">
                {command}
              </pre>
              <div className="border-t p-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(command).then(
                      () => toast.success("Command copied"),
                      () => toast.error("Could not copy the command"),
                    )
                  }}
                >
                  Copy command
                </Button>
              </div>
            </div>
          ))}
          {lines.length > 0 && <LogPanel lines={lines} />}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {doctor.actions.map((action) => (
              <Button
                key={action.id}
                type="button"
                variant="outline"
                disabled={activeAction !== null}
                onClick={() => void runAction(action.id)}
              >
                {activeAction === action.id ? "Running…" : action.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={() => openExternal(doctor.download_url)}
            >
              Open Docker download page
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={activeAction !== null}
              onClick={onRefresh}
            >
              Retry
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => window.close()}
            >
              Quit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
