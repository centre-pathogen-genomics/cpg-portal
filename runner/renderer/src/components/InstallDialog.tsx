import { useCallback, useEffect, useRef, useState } from "react"
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
import { api, errorMessage } from "../api"
import type { InstallMessage, ToolConfig } from "../contracts"
import { LogPanel } from "./LogPanel"

export function InstallDialog({
  open,
  tool,
  installing,
  onRefreshStatus,
  onDismiss,
}: {
  open: boolean
  tool: ToolConfig | null
  installing: boolean
  onRefreshStatus: () => void
  onDismiss: () => void
}) {
  const [lines, setLines] = useState<string[]>([])
  const [working, setWorking] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)

  const closeSocket = useCallback(() => {
    socketRef.current?.close()
    socketRef.current = null
  }, [])

  const subscribe = useCallback(() => {
    closeSocket()
    const socket = new WebSocket(api.wsUrl("/install/logs"))
    socketRef.current = socket
    socket.onmessage = (event) => {
      let message: InstallMessage
      try {
        message = JSON.parse(String(event.data)) as InstallMessage
      } catch {
        return
      }
      if (message.type === "log") {
        setLines((previous) => [...previous, message.line].slice(-500))
      } else if (message.type === "state") {
        if (message.state === "installed") {
          closeSocket()
          setWorking(false)
          setFailure(null)
          onRefreshStatus()
        } else if (message.state === "failed") {
          closeSocket()
          setWorking(false)
          setFailure("Installation failed")
        }
      }
    }
    socket.onerror = () => {
      closeSocket()
      setWorking(false)
      setFailure((previous) => previous ?? "The installation log connection was lost")
    }
    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [closeSocket, onRefreshStatus])

  useEffect(() => closeSocket, [closeSocket])

  useEffect(() => {
    if (!open || !installing || socketRef.current) return
    subscribe()
  }, [open, installing, subscribe])

  async function startInstall() {
    if (working) return
    setWorking(true)
    setFailure(null)
    setLines([])
    try {
      await api.post("/install")
    } catch (error) {
      toast.error(errorMessage(error))
      setWorking(false)
      onRefreshStatus()
      return
    }
    subscribe()
  }

  const busy = working || installing

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Install {tool?.name ?? "the tool"}</DialogTitle>
          <DialogDescription>
            The first start downloads the runtime image and installs the tool
            environment.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-3 overflow-auto pr-1">
          {lines.length > 0 ? (
            <LogPanel lines={lines} className="h-72" />
          ) : (
            <p className="text-muted-foreground text-sm">
              Nothing has been installed yet.
            </p>
          )}
          {failure && <p className="text-destructive text-sm">{failure}</p>}
        </div>

        <DialogFooter>
          <Button type="button" disabled={busy} onClick={() => void startInstall()}>
            {busy ? "Installing…" : failure ? "Retry" : "Install"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDismiss}>
            Cancel
          </Button>
          <Button type="button" variant="ghost" onClick={() => window.close()}>
            Quit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
