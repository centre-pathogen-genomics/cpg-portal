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
      /** Cached tool pictures, by tool id, as data URLs. */
      toolImages(): Promise<Record<string, string>>
      importPacks(): Promise<ToolEntry[]>
      importPackPaths(files: string[]): Promise<ToolEntry[]>
      openTool(toolId: string): Promise<void>
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
