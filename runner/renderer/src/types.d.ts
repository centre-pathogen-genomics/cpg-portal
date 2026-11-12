import type { PortalToolDetail, PortalToolSummary } from "./contracts"

export {}

// An installed tool, as the main process describes it to the window. Kept in
// step with the bridge in `electron/preload.ts`.
type ToolEntry = {
  id: string
  name: string
  version: string
  description: string | null
}


declare global {
  interface Window {
    cpgRunner?: {
      token: string
      /** Origin of the portal this build belongs to; empty when unknown. */
      portalUrl: string
      tools(): Promise<ToolEntry[]>
      /** The tool the window shows, also after a reload. */
      currentTool(): Promise<{ toolId: string; port: number } | null>
      /** Cached tool pictures, by tool id, as data URLs. */
      toolImages(): Promise<Record<string, string>>
      /** The portal's catalogue, one row per tool name. */
      portalTools(): Promise<PortalToolSummary[]>
      /** The portal's search, across every tool it hosts. */
      portalSearch(query: string): Promise<PortalToolSummary[]>
      portalTool(target: {
        name: string
        version?: string
      }): Promise<PortalToolDetail>
      /** Downloads a portal tool and opens it; replaces the same name and version. */
      addPortalTool(target: {
        name: string
        version?: string
      }): Promise<ToolEntry>
      importPacks(): Promise<ToolEntry[]>
      importPackPaths(files: string[]): Promise<ToolEntry[]>
      openTool(toolId: string): Promise<void>
      /** Called instead of a page load when the window shows another tool. */
      onShowTool(
        handler: (target: { toolId: string; port: number }) => void,
      ): () => void
      home(): Promise<void>
      ready(): void
      pickFiles(options: {
        extensions?: string[]
        multiple?: boolean
      }): Promise<string[]>
      pickDirectory(defaultPath?: string): Promise<string | null>
      revealPath(target: string): Promise<void>
      openPath(target: string): Promise<string>
      openExternal(url: string): Promise<boolean>
      getPathForFile(file: File): string
    }
  }
}
