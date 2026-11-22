// The portal the app talks to. The main process owns the effective value — a
// portal chosen in Settings, else the one this build ships with — and the
// window mirrors it so the many synchronous call sites read one value.
let current: string | null = null

/** The portal this build belongs to, or the development default. */
export function portalUrl(): string {
  if (current !== null) return current
  const fromApp = window.cpgRunner?.portalUrl
  if (fromApp) return fromApp
  const configured = import.meta.env.VITE_CPG_PORTAL_URL
  return typeof configured === "string" ? configured : "http://localhost:8000"
}

/** Points the window at the portal the main process uses. */
export function setPortalUrl(url: string): void {
  current = url.replace(/\/+$/, "")
}

/** The tool's page on that portal. */
export function portalToolUrl(name: string): string {
  return `${portalUrl().replace(/\/+$/, "")}/tools/${encodeURIComponent(name)}`
}
