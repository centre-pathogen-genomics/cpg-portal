import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"
import { useState } from "react"
import { FiShare2 } from "react-icons/fi"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { RunPublic } from "../../client"
import {
  readRunQueryKey,
  toggleRunSharingMutation,
} from "../../client/@tanstack/react-query.gen"
import useCustomToast from "../../hooks/useCustomToast"

function ShareRunButton({ run }: { run: RunPublic }) {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [open, setOpen] = useState(false)
  const [isShared, setIsShared] = useState(run.shared || false)
  const mutation = useMutation({
    ...toggleRunSharingMutation(),
    onSuccess: (updatedRun) => {
      queryClient.setQueryData(
        readRunQueryKey({ path: { id: run.id } }),
        updatedRun,
      )
      showToast(
        "Success!",
        `Run sharing ${updatedRun.shared ? "enabled" : "disabled"} successfully.`,
        "success",
      )
      queryClient.invalidateQueries({ queryKey: [{ _id: "runsReadRuns" }] })
      setOpen(false)
    },
    onError: (error: any) => {
      showToast("Something went wrong.", `${error.body?.detail}`, "error")
    },
  })

  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) setIsShared(run.shared || false)
    setOpen(nextOpen)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={run.shared ? "border-green-500 text-green-600" : undefined}
        onClick={() => changeOpen(true)}
      >
        <FiShare2 />
        {run.shared ? "Shared" : "Share"}
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Run</DialogTitle>
            <DialogDescription>
              Configure sharing settings for this run. When shared, other users
              with this URL will be able to view the run results.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <Label htmlFor="share-toggle">Enable sharing</Label>
            <Switch
              id="share-toggle"
              checked={isShared}
              onCheckedChange={setIsShared}
            />
          </div>
          {isShared && (
            <p className="text-sm text-orange-500">
              When sharing is enabled, any user with the run link can view the
              results.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={isShared ? "default" : "destructive"}
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  path: { id: run.id },
                  query: { shared: isShared },
                })
              }
            >
              {mutation.isPending && <LoaderCircle className="animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ShareRunButton
