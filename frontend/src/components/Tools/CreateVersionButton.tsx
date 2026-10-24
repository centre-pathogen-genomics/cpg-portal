import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { LoaderCircle } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { ToolPublic } from "../../client"
import { createToolVersionMutation } from "../../client/@tanstack/react-query.gen"

/** The API's `detail` message from a failed request, when it carried one. */
function errorDetail(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return undefined
  }
  const { response } = error
  if (!response || typeof response !== "object" || !("data" in response)) {
    return undefined
  }
  const { data } = response
  if (!data || typeof data !== "object" || !("detail" in data)) {
    return undefined
  }
  return typeof data.detail === "string" ? data.detail : undefined
}

/** Ask for a version, create it as a disabled copy, then open it for editing. */
export default function CreateVersionButton({ tool }: { tool: ToolPublic }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [version, setVersion] = useState("")
  const [error, setError] = useState<string | null>(null)
  const createVersion = useMutation({
    ...createToolVersionMutation(),
    onSuccess: (created) => {
      setOpen(false)
      setVersion("")
      setError(null)
      navigate({
        to: "/tools/$name/edit",
        params: { name: created.name },
        search: { version: created.version ?? "" },
      })
    },
    onError: (requestError) => {
      setError(
        errorDetail(requestError) ??
          "An error occurred while creating the version.",
      )
    },
  })
  const create = () => {
    const next = version.trim()
    if (!next) {
      setError("Version is required")
      return
    }
    createVersion.mutate({
      path: { tool_id: tool.id },
      query: { version: next },
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setVersion("")
          setError(null)
          setOpen(true)
        }}
      >
        Create new version
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new version</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A copy of {tool.name} is created with this version, disabled and not
            installed, and opened for editing.
          </p>
          <Input
            placeholder="Version, e.g. 1.1.0"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && create()}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={create}
              disabled={!version.trim() || createVersion.isPending}
            >
              {createVersion.isPending && (
                <LoaderCircle className="animate-spin" />
              )}
              Create version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
