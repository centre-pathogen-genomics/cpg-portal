import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ListOrdered, LoaderCircle } from "lucide-react"
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
import { Input } from "@/components/ui/input"
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

/** Where a version sits in its stack, and which one the plain name serves. */
export default function ToolVersionsAdmin({ tool }: { tool: ToolPublic }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [orders, setOrders] = useState<Record<string, string>>({})
  const [defaultId, setDefaultId] = useState("")
  const { data: versions } = useQuery({
    ...readToolVersionsOptions({ path: { tool_name: tool.name } }),
    enabled: open,
  })
  const update = useMutation({
    ...updateToolMutation(),
    onError: (error) => handleError(error, toast.error),
  })

  // Start from what the stack holds now.
  useEffect(() => {
    if (!open || !versions) return
    setOrders(
      Object.fromEntries(
        versions.map((version) => [
          version.id,
          version.version_sort === null || version.version_sort === undefined
            ? ""
            : String(version.version_sort),
        ]),
      ),
    )
    setDefaultId(versions.find((version) => version.is_default)?.id ?? "")
  }, [open, versions])

  const save = async () => {
    const stack = versions ?? []
    const nextOrders = new Map<string, number | null>()
    for (const version of stack) {
      const typed = (orders[version.id] ?? "").trim()
      if (typed === "") {
        nextOrders.set(version.id, null)
        continue
      }
      const parsed = Number(typed)
      if (!Number.isInteger(parsed)) {
        toast.error(`Order for v${version.version} has to be a whole number`)
        return
      }
      nextOrders.set(version.id, parsed)
    }
    setSaving(true)
    try {
      for (const version of stack) {
        const nextOrder = nextOrders.get(version.id) ?? null
        const previousOrder = version.version_sort ?? null
        if (nextOrder !== previousOrder) {
          await update.mutateAsync({
            path: { tool_id: version.id },
            body: { version_sort: nextOrder },
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
            Pick the default version, the one {"/tools/"}
            {tool.name} serves, and set the order each version lists in. An
            empty order falls back to the creation time, which suits versions
            named after git commit hashes.
          </p>
          {versions && versions.length === 0 && (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          )}
          <RadioGroup
            value={defaultId}
            onValueChange={setDefaultId}
            className="gap-0"
          >
            {(versions ?? []).map((version) => (
              <div
                key={version.id}
                className="flex items-center gap-3 border-b py-2 last:border-b-0"
              >
                <RadioGroupItem
                  value={version.id}
                  id={`default-version-${version.id}`}
                />
                <Label
                  htmlFor={`default-version-${version.id}`}
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
                <Label
                  htmlFor={`version-order-${version.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Order
                </Label>
                <Input
                  id={`version-order-${version.id}`}
                  className="w-20"
                  inputMode="numeric"
                  value={orders[version.id] ?? ""}
                  onChange={(event) =>
                    setOrders({
                      ...orders,
                      [version.id]: event.target.value,
                    })
                  }
                />
              </div>
            ))}
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
