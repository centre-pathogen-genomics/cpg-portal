import { toast } from "sonner"

export function openPath(target: string): void {
  const bridge = window.cpgRunner
  if (!bridge) {
    toast.error("Opening files requires the desktop app")
    return
  }
  void bridge.openPath(target).then((error) => {
    if (error) toast.error(error)
  })
}

export function revealPath(target: string): void {
  const bridge = window.cpgRunner
  if (!bridge) {
    toast.error("Showing files requires the desktop app")
    return
  }
  void bridge.revealPath(target)
}

export function openExternal(url: string): void {
  const bridge = window.cpgRunner
  if (bridge) {
    void bridge.openExternal(url).catch(() => {
      toast.error("Could not open the browser")
    })
    return
  }
  window.open(url, "_blank", "noopener")
}

export async function pickFiles(options: {
  extensions: string[]
  multiple: boolean
}): Promise<string[]> {
  const bridge = window.cpgRunner
  if (!bridge) {
    toast.error("Choosing files requires the desktop app")
    return []
  }
  return bridge.pickFiles(options)
}

export async function pickDirectory(
  defaultPath?: string,
): Promise<string | null> {
  const bridge = window.cpgRunner
  if (!bridge) {
    toast.error("Choosing a folder requires the desktop app")
    return null
  }
  return bridge.pickDirectory(defaultPath)
}

export function filePathOf(file: File): string {
  return window.cpgRunner?.getPathForFile(file) ?? ""
}
