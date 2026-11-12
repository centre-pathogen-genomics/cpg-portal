import { Download, LoaderCircle } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { detectPlatform } from "@/lib/runner-platform"
import type { ToolPublic } from "../../client"

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

/**
 * Downloads this tool's pack, which the CPG Runner desktop app opens: the
 * app itself is one download for every tool, so it lives on `/local-runner`.
 */
function RunLocallyButton({ tool }: { tool: ToolPublic }) {
  const { user } = useAuth()
  const showToast = useCustomToast()
  const [isDownloadingPack, setIsDownloadingPack] = useState(false)

  if (!user) return null

  const downloadPack = async () => {
    setIsDownloadingPack(true)
    try {
      const platform = detectPlatform()
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
      Run locally
    </Button>
  )
}

export default RunLocallyButton
