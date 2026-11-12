export const PLATFORMS = [
  { value: "mac-arm64", label: "macOS (Apple silicon)" },
  { value: "mac-x64", label: "macOS (Intel)" },
  { value: "win-x64", label: "Windows (x64)" },
  { value: "linux-x64", label: "Linux (x64)" },
] as const

export type Platform = (typeof PLATFORMS)[number]["value"]

/** The runner build for the computer the browser is running on. */
export function detectPlatform(): Platform {
  if (navigator.userAgent.includes("Mac")) return "mac-arm64"
  if (navigator.userAgent.includes("Win")) return "win-x64"
  return "linux-x64"
}

/** Where the desktop app for a platform is served from. */
export function runnerAppUrl(platform: Platform): string {
  return `${import.meta.env.VITE_API_URL}/api/v1/runner/app/${platform}`
}
