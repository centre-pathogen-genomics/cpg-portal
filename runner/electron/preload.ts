import { contextBridge, ipcRenderer, webUtils } from "electron"

// The shape the renderer sees for an installed tool. It is repeated in
// `renderer/src/types.d.ts`, which is the contract for the window object.
type ToolEntry = {
  id: string
  name: string
  version: string
  description: string | null
}

const TOKEN_ARGUMENT = "--cpg-token="
const tokenArgument = process.argv.find((argument) =>
  argument.startsWith(TOKEN_ARGUMENT),
)
const token = tokenArgument ? tokenArgument.slice(TOKEN_ARGUMENT.length) : ""

const PORTAL_ARGUMENT = "--cpg-portal="
const portalArgument = process.argv.find((argument) =>
  argument.startsWith(PORTAL_ARGUMENT),
)
const portalUrl = portalArgument
  ? portalArgument.slice(PORTAL_ARGUMENT.length)
  : ""

contextBridge.exposeInMainWorld("cpgRunner", {
  token,
  portalUrl,
  tools: (): Promise<ToolEntry[]> => ipcRenderer.invoke("runner:tools"),
  toolImages: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke("runner:tool-images"),
  portalTools: (): Promise<unknown[]> =>
    ipcRenderer.invoke("runner:portal-tools"),
  portalTool: (target: { name: string; version?: string }): Promise<unknown> =>
    ipcRenderer.invoke("runner:portal-tool", target),
  addPortalTool: (target: {
    name: string
    version?: string
  }): Promise<ToolEntry> => ipcRenderer.invoke("runner:add-portal-tool", target),
  importPacks: (): Promise<ToolEntry[]> =>
    ipcRenderer.invoke("runner:import-packs"),
  importPackPaths: (files: string[]): Promise<ToolEntry[]> =>
    ipcRenderer.invoke("runner:import-paths", files),
  openTool: (toolId: string): Promise<void> =>
    ipcRenderer.invoke("runner:open-tool", toolId),
  home: (): Promise<void> => ipcRenderer.invoke("runner:home"),
  /** The window has rendered: the splash can go. */
  ready: (): void => ipcRenderer.send("runner:ready"),
  pickFiles: (options: {
    extensions?: string[]
    multiple?: boolean
  }): Promise<string[]> => ipcRenderer.invoke("runner:pick-files", options),
  pickDirectory: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke("runner:pick-directory", defaultPath),
  revealPath: (target: string): Promise<void> =>
    ipcRenderer.invoke("runner:reveal", target),
  openPath: (target: string): Promise<string> =>
    ipcRenderer.invoke("runner:open-path", target),
  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke("runner:open-external", url),
  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ""
    }
  },
})
