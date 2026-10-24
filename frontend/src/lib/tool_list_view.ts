/**
 * How the tool list lists its entries: the picture cards, or one compact row
 * each. The choice sticks, so it survives a reload and other pages.
 */
export type ToolListView = "cards" | "rows"

const STORAGE_KEY = "cpg-portal:tool-list-view"

export function getToolListView(): ToolListView {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "rows"
      ? "rows"
      : "cards"
  } catch {
    return "cards"
  }
}

export function setToolListView(view: ToolListView): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, view)
  } catch {
    // Storage can be unavailable (private mode, quota): the view holds for
    // this page either way.
  }
}
