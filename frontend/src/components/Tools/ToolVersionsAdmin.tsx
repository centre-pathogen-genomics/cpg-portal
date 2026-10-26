import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, ListOrdered, LoaderCircle } from "lucide-react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { ToolPublic } from "../../client"
import {
  readToolByNameQueryKey,
  readToolsQueryKey,
  readToolVersionsOptions,
  readToolVersionsQueryKey,
  updateToolMutation,
} from "../../client/@tanstack/react-query.gen"
import { handleError } from "../../utils"

/** Order a tool's versions with the arrows, and pick the default. */
export default function ToolVersionsAdmin({ tool }: { tool: ToolPublic }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [order, setOrder] = useState<string[]>([])
  const [defaultId, setDefaultId] = useState("")
  const { data: versions } = useQuery({
    ...readToolVersionsOptions({ path: { tool_name: tool.name } }),
    enabled: open,
  })
  const update = useMutation({
    ...updateToolMutation(),
    onError: (error) => handleError(error, toast.error),
  })
  const byId = new Map((versions ?? []).map((version) => [version.id, version]))

  // Start from the order the stack is in now.
  useEffect(() => {
    if (!open || !versions) return
    setOrder(versions.map((version) => version.id))
    setDefaultId(versions.find((version) => version.is_default)?.id ?? "")
  }, [open, versions])

  const move = (index: number, to: number) => {
    if (to < 0 || to >= order.length) return
    const next = [...order]
    const [moved] = next.splice(index, 1)
    next.splice(to, 0, moved)
    setOrder(next)
  }

  const save = async () => {
    setSaving(true)
    try {
      for (const [index, id] of order.entries()) {
        const version = byId.get(id)
        if (!version) continue
        // The arrows name a position, which is stored as 1..n so the stack
        // reads back in the same order.
        const position = index + 1
        if ((version.version_sort ?? null) !== position) {
          await update.mutateAsync({
            path: { tool_id: version.id },
            body: { version_sort: position },
          })
        }
        // Making one version the default clears it on the others, so the stack
        // always keeps one.
        if (version.id === defaultId && !version.is_default) {
          await update.mutateAsync({
            path: { tool_id: version.id },
            body: { is_default: true },
          })
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: readToolVersionsQueryKey({
            path: { tool_name: tool.name },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: readToolByNameQueryKey({ path: { tool_name: tool.name } }),
        }),
        queryClient.invalidateQueries({ queryKey: readToolsQueryKey() }),
      ])
      toast.success("Versions updated")
      setOpen(false)
    } catch {
      // The mutation reported the failure already.
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setOpen(true)
        }}
      >
        <ListOrdered />
        Versions
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Versions of {tool.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Move a version up or down to set the order the stack lists in, and
            pick the default, the one {"/tools/"}
            {tool.name} serves.
          </p>
          {versions && versions.length === 0 && (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          )}
          <RadioGroup
            value={defaultId}
            onValueChange={setDefaultId}
            className="gap-0"
          >
            {order.map((id, index) => {
              const version = byId.get(id)
              if (!version) return null

              return (
                <div
                  key={id}
                  className="flex items-center gap-2 border-b py-2 last:border-b-0"
                >
                  <RadioGroupItem value={id} id={`default-version-${id}`} />
                  <Label
                    htmlFor={`default-version-${id}`}
                    className="flex-1 cursor-pointer"
                  >
                    v{version.version}
                    {version.is_default && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        current default
                      </span>
                    )}
                    {!version.enabled && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        disabled
                      </span>
                    )}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move v${version.version} up`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move v${version.version} down`}
                    disabled={index === order.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ChevronDown />
                  </Button>
                </div>
              )
            })}
          </RadioGroup>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !versions?.length}>
              {saving && <LoaderCircle className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
