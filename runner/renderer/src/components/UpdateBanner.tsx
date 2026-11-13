import { Download, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const DISMISSED_KEY = "cpg-runner:update-dismissed"

type AppUpdate = { version: string; url: string }

function readDismissed(): string {
  try {
    return localStorage.getItem(DISMISSED_KEY) ?? ""
  } catch {
    return ""
  }
}

/**
 * A newer build of this app, when the portal announces one. The download stays
 * on the portal: this app never replaces itself, it only says what is there.
 * A dismissed version stays dismissed, even across launches.
 */
export function UpdateBanner() {
  const [update, setUpdate] = useState<AppUpdate | null>(null)
  const [dismissed, setDismissed] = useState(readDismissed)

  useEffect(() => {
    void window.cpgRunner?.update?.().then((next) => {
      if (next) setUpdate(next)
    })
    return window.cpgRunner?.onUpdateAvailable?.((next) => setUpdate(next))
  }, [])

  if (!update || update.version === dismissed) return null
  const shown = update

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, shown.version)
    } catch {
      // A window without storage shows the notice again next launch.
    }
    setDismissed(shown.version)
    setUpdate(null)
  }

  return (
    <div
      role="status"
      className="bg-popover text-popover-foreground fixed bottom-4 left-4 z-50 w-80 rounded-md border p-4 shadow-lg"
    >
      <p className="text-sm font-semibold">
        CPG Runner {shown.version} is available
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        Download it, then quit and replace the app.
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button asChild size="sm">
          <a href={shown.url} download>
            <Download />
            Download
          </a>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss the update notice"
          title="Dismiss the update notice"
          onClick={dismiss}
        >
          <X />
        </Button>
      </div>
    </div>
  )
}
