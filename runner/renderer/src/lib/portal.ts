/** The portal this build belongs to, or the development default. */
export function portalUrl(): string {
  const fromApp = window.cpgRunner?.portalUrl
  if (fromApp) return fromApp
  const configured = import.meta.env.VITE_CPG_PORTAL_URL
  return typeof configured === "string" ? configured : "http://localhost:8000"
}

/** The tool's page on that portal. */
export function portalToolUrl(name: string): string {
  return `${portalUrl().replace(/\/+$/, "")}/tools/${encodeURIComponent(name)}`
}
