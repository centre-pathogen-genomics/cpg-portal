/**
 * Remembers, per tool name, the version the user last picked, so returning to
 * `/tools/<name>` opens that version instead of the stack's default.
 */
const STORAGE_KEY = "cpg-portal:tool-versions"

function readAll(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) => typeof value === "string",
      ) as [string, string][],
    )
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // Storage can be unavailable (private mode, quota): remembering is optional.
  }
}

export function getLastVersion(toolName: string): string | undefined {
  return readAll()[toolName]
}

export function rememberVersion(toolName: string, version: string): void {
  writeAll({ ...readAll(), [toolName]: version })
}

/** Forget the name, so the plain link opens the default again. */
export function forgetVersion(toolName: string): void {
  const all = readAll()
  if (!(toolName in all)) return
  delete all[toolName]
  writeAll(all)
}
