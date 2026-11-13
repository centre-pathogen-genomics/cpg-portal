import type { PortalToolDetail, PortalToolSummary } from "./contracts"

export {}

// An installed tool, as the main process describes it to the window. Kept in
// step with the bridge in `electron/preload.ts`.
type ToolEntry = {
  id: string
  name: string
  version: string
  description: string | null
  image: string | null
  /** Why the tool cannot be read, when its files no longer parse. */
  problem: string | null
}

/** A newer build of the app, as the portal advertises it. */
type AppUpdatePayload = { version: string; url: string }

declare global {
  interface Window {
    cpgRunner?: {
      token: string
      /** Origin of the portal this build belongs to; empty when unknown. */
      portalUrl: string
      /** This build's version, e.g. "1.0.0"; empty when unknown. */
      appVersion: string
      /** A newer build the portal already announced, if there is one. */
      update(): Promise<AppUpdatePayload | null>
      /** A newer build was announced after the window loaded. */
      onUpdateAvailable(handler: (update: AppUpdatePayload) => void): () => void
      tools(): Promise<ToolEntry[]>
      /** Cached tool pictures, by tool id, as data URLs. */
      toolImages(): Promise<Record<string, string>>
      /** Keeps a picture the window saw first, so it works offline later. */
      cacheToolImage(toolId: string, url: string): Promise<void>
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
      /** Deletes the tool and opens another one; outputs stay on disk. */
      removeTool(toolId: string): Promise<void>
      /** A tool was added or removed elsewhere; reload the lists. */
      onToolsChanged(handler: () => void): () => void
      /** Called instead of a page load when the window shows another tool. */
      onShowTool(handler: (target: { toolId: string }) => void): () => void
      /** The tool on screen was removed; the window should leave its route. */
      onToolRemoved(handler: (target: { toolId: string }) => void): () => void
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
