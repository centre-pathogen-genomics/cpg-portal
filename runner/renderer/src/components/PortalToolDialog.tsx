import { LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type { PortalToolDetail } from "../contracts"
import { openExternal } from "../lib/desktop"
import { portalToolUrl } from "../lib/portal"
import { ToolHeading } from "./ToolHeading"
import { placeholderImage } from "./ToolImage"

type Target = { name: string; version: string }

/**
 * One tool from the portal: its picture, versions and what it does, with the
 * choice to install it here (replacing the same name and version).
 */
export function PortalToolDialog({
  target,
  installed,
  onOpenChange,
  onAdded,
}: {
  target: Target | null
  installed: { name: string; version: string }[]
  onOpenChange: (open: boolean) => void
  /** The tool is installed and about to open; the list can reload. */
  onAdded?: () => void
}) {
  const [version, setVersion] = useState("")
  const [detail, setDetail] = useState<PortalToolDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    setDetail(null)
    setError(null)
    setVersion(target?.version ?? "")
  }, [target])

  useEffect(() => {
    if (!target) return
    let cancelled = false
    void window.cpgRunner
      ?.portalTool?.({ name: target.name, version: version || undefined })
      .then((loaded) => {
        if (!cancelled) setDetail(loaded)
      })
      .catch((reason) => {
        if (!cancelled) setError(String(reason).replace(/^Error: /, ""))
      })
    return () => {
      cancelled = true
    }
  }, [target, version])

  const replaces =
    !!detail &&
    installed.some(
      (tool) => tool.name === detail.name && tool.version === detail.version,
    )

  async function add() {
    if (!detail) return
    setAdding(true)
    try {
      await window.cpgRunner?.addPortalTool?.({
        name: detail.name,
        version: detail.version || undefined,
      })
      onAdded?.()
      onOpenChange(false)
    } catch (reason) {
      toast.error(String(reason).replace(/^Error: /, ""))
    } finally {
      setAdding(false)
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <ToolHeading
            image={
              detail?.image ??
              placeholderImage(detail?.name ?? target?.name ?? "")
            }
            name={detail?.name ?? target?.name ?? ""}
            version={detail?.version}
            heading={DialogTitle}
          />
        </DialogHeader>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {!error && !detail && (
          <div className="grid gap-3 py-1" aria-hidden="true">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            <Skeleton className="h-9 w-48" />
          </div>
        )}

        {detail && (
          <div className="grid gap-3">
            {detail.versions.length > 1 && (
              <div className="grid gap-2">
                <Label htmlFor="portal-version">Version</Label>
                <Select value={version} onValueChange={setVersion}>
                  <SelectTrigger id="portal-version" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {detail.versions.map((option: string) => (
                      <SelectItem key={option || "latest"} value={option}>
                        {option || "latest"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {detail.description && (
              <p className="text-muted-foreground text-sm">
                {detail.description}
              </p>
            )}

            {replaces && (
              <p className="text-destructive text-sm">
                {`${detail.name} ${detail.version || ""} is already installed here.`}{" "}
                Installing replaces it and sets up its environment again.
              </p>
            )}

            <div>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => openExternal(portalToolUrl(detail.name))}
              >
                Open on the portal
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button
            type="button"
            disabled={!detail || adding}
            onClick={() => void add()}
          >
            {adding && <LoaderCircle className="animate-spin" />}
            {replaces ? "Replace local copy" : "Add to this computer"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={adding}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
