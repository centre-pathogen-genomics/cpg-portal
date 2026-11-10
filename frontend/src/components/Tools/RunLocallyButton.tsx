import { Download, LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import type { ToolPublic } from "../../client"

const PLATFORMS = [
  { value: "mac-arm64", label: "macOS (Apple silicon)" },
  { value: "mac-x64", label: "macOS (Intel)" },
  { value: "win-x64", label: "Windows (x64)" },
  { value: "linux-x64", label: "Linux (x64)" },
] as const

type Platform = (typeof PLATFORMS)[number]["value"]

function detectPlatform(): Platform {
  if (navigator.userAgent.includes("Mac")) return "mac-arm64"
  if (navigator.userAgent.includes("Win")) return "win-x64"
  return "linux-x64"
}

/**
 * The server names the pack, so a download keeps the sanitised tool and
 * version it was built from. Cross-origin responses only expose the header
 * when CORS lists it, so callers fall back to a local name.
 */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (encoded) return decodeURIComponent(encoded[1])
  const quoted = /filename="([^"]+)"/i.exec(header)
  if (quoted) return quoted[1]
  const bare = /filename=([^;]+)/i.exec(header)
  return bare ? bare[1].trim() : null
}

function RunLocallyButton({ tool }: { tool: ToolPublic }) {
  const { user } = useAuth()
  const showToast = useCustomToast()
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<Platform>(detectPlatform)
  const [isDownloadingPack, setIsDownloadingPack] = useState(false)
  // Identity of the build behind the app URL. Pinning the link to it makes a
  // download always the current build, even when an older one was cached.
  const [appBuild, setAppBuild] = useState("")

  const appUrl = `${import.meta.env.VITE_API_URL}/api/v1/runner/app/${platform}`

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setAppBuild("")
    fetch(appUrl, { method: "HEAD" })
      .then((response) => response.headers.get("etag") ?? "")
      .then((etag) => {
        if (!cancelled) setAppBuild(etag.replace(/"/g, ""))
      })
      .catch(() => {
        // Without the build, a fresh URL per attempt still beats a cache hit on
        // an older release: the server revalidates it and answers 304.
        if (!cancelled) setAppBuild(`t${Date.now()}`)
      })
    return () => {
      cancelled = true
    }
  }, [open, appUrl])

  if (!user) return null

  const appHref = appBuild ? `${appUrl}?v=${appBuild}` : appUrl

  const downloadPack = async () => {
    setIsDownloadingPack(true)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tools/name/${encodeURIComponent(tool.name)}/runner-pack?platform=${platform}&version=${encodeURIComponent(tool.version ?? "")}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        },
      )
      if (!response.ok) {
        let detail = ""
        try {
          const body = (await response.json()) as { detail?: string }
          detail = body.detail ?? ""
        } catch {
          // A non-JSON error body leaves the generic message in place.
        }
        showToast.showErrorToast(detail || "Could not prepare the download")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download =
        filenameFromDisposition(response.headers.get("content-disposition")) ??
        `${tool.name}-${tool.version ?? "latest"}.cpgpack`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast.showErrorToast("Could not prepare the download")
    } finally {
      setIsDownloadingPack(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download />
          Run locally
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download CPG Runner</DialogTitle>
          <DialogDescription>
            Run {tool.name} {tool.version} on your own computer. Pick the
            platform of that computer first; both downloads below use it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="run-locally-platform">Platform</Label>
          <Select
            value={platform}
            onValueChange={(value) => setPlatform(value as Platform)}
          >
            <SelectTrigger id="run-locally-platform" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2 rounded-md border p-3">
          <div className="text-sm font-medium">1. Download CPG Runner</div>
          <p className="text-muted-foreground text-sm">
            The desktop app for this platform. Download this once; every tool
            pack reuses it.
            {appBuild && (
              <span className="ml-1 font-mono text-xs">
                build {appBuild}
              </span>
            )}
          </p>
          <Button variant="outline" asChild>
            <a href={appHref} download>
              <Download />
              Download CPG Runner
            </a>
          </Button>
        </div>

        <div className="grid gap-2 rounded-md border p-3">
          <div className="text-sm font-medium">2. Download tool pack</div>
          <p className="text-muted-foreground text-sm">
            A few kilobytes with {tool.name} {tool.version} and its settings.
            Double-click the pack, or drop it on the CPG Runner window, to add
            the tool to the app.
          </p>
          <Button
            variant="outline"
            onClick={downloadPack}
            disabled={isDownloadingPack}
          >
            {isDownloadingPack ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Download />
            )}
            Download tool pack
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default RunLocallyButton
