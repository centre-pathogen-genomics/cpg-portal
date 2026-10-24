import { useState } from "react"

/** How a list of records lists its entries. */
export type ViewMode = "cards" | "list" | "table"

/**
 * How one browser wants a list of records laid out: the picture cards, one
 * compact row each, or a table. Lists that share a key share the choice - the
 * runs and files pages do, while the tool list keeps its own - and it sticks,
 * so it survives a reload.
 */
const PREFIX = "cpg-portal:view:"

export default function useViewMode(
  key: string = "lists",
  fallback: ViewMode = "table",
): [ViewMode, (mode: ViewMode) => void] {
  const storageKey = PREFIX + key
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      return stored === "cards" || stored === "list" || stored === "table"
        ? stored
        : fallback
    } catch {
      return fallback
    }
  })
  const choose = (next: ViewMode) => {
    setMode(next)
    try {
      window.localStorage.setItem(storageKey, next)
    } catch {
      // Storage can be unavailable (private mode, quota): the choice still
      // holds for this page.
    }
  }
  return [mode, choose]
}
