import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

const DISMISSED_KEY = "cpg-runner:update-dismissed"
const TOAST_ID = "cpg-runner:update-available"

type AppUpdate = { version: string; url: string }

function readDismissed(): string {
  try {
    return localStorage.getItem(DISMISSED_KEY) ?? ""
  } catch {
    return ""
  }
}

/**
 * The download stays on the portal: this app never replaces itself, it only
 * says what is there. Clicking "Download update" saves the newer build the
 * same way the old banner's `<a href download>` did.
 */
function download(url: string): void {
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = ""
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

/**
 * A newer build of this app, when the portal announces one. Rendered through
 * the shared sonner Toaster (mounted once in main.tsx) so the runner has one
 * toast system. The toast stays open until it is dismissed or actioned; a
 * dismissed version stays dismissed, even across launches.
 */
export function UpdateBanner() {
  const activeRef = useRef<string | null>(null)
  const dismissedRef = useRef(readDismissed())

  const show = useCallback((next: AppUpdate) => {
    // Already on screen, or the user dismissed this exact version before.
    if (
      next.version === activeRef.current ||
      next.version === dismissedRef.current
    ) {
      return
    }
    activeRef.current = next.version
    toast.info(`CPG Runner ${next.version} is available`, {
      id: TOAST_ID,
      description: "Download it, then quit and replace the app.",
      // Stays put until the user acts, like the banner it replaces.
      duration: Infinity,
      action: {
        label: "Download update",
        onClick: () => download(next.url),
      },
      onDismiss: () => {
        try {
          localStorage.setItem(DISMISSED_KEY, next.version)
        } catch {
          // A window without storage shows the notice again next launch.
        }
        dismissedRef.current = next.version
        activeRef.current = null
      },
    })
  }, [])

  useEffect(() => {
    void window.cpgRunner?.update?.().then((next) => {
      if (next) show(next)
    })
    return window.cpgRunner?.onUpdateAvailable?.((next) => show(next))
  }, [show])

  return null
}
