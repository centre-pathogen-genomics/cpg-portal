import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { createGroupMutation } from "../../client/@tanstack/react-query.gen"
import useCustomToast from "../../hooks/useCustomToast"

interface CreateGroupButtonProps {
  selectedFileIds: string[]
  onGroupCreated?: () => void
  size?: "xs" | "sm" | "md" | "lg"
  variant?: string
  colorScheme?: string
}

export default function CreateGroupButton({
  selectedFileIds,
  onGroupCreated,
  size = "md",
}: CreateGroupButtonProps) {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [open, setOpen] = useState(false)
  const createGroup = useMutation({
    ...createGroupMutation(),
    onSuccess: () => {
      showToast("Success", "Group created successfully.", "success")
      setName("")
      setError(null)
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ["files"] })
      onGroupCreated?.()
    },
    onError: (requestError: any) => {
      const message =
        requestError?.response?.data?.detail ||
        "An error occurred while creating the group."
      setError(message)
      showToast("Error", message, "error")
    },
  })
  const create = () => {
    if (!name.trim()) {
      setError("Group name is required")
      return
    }
    createGroup.mutate({ body: selectedFileIds, query: { name: name.trim() } })
  }
  const show = () => {
    setName("")
    setError(null)
    setOpen(true)
  }
  return (
    <>
      <Button
        size={size === "md" ? "default" : size === "xs" ? "sm" : size}
        onClick={show}
        disabled={!selectedFileIds.length}
      >
        {selectedFileIds.length
          ? `Create Group (${selectedFileIds.length})`
          : "Select to Group"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create File Group</DialogTitle>
          </DialogHeader>
          <p>Enter a name for the group of {selectedFileIds.length} files:</p>
          <Input
            placeholder="Group name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && create()}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={create}
              disabled={!name.trim() || createGroup.isPending}
            >
              {createGroup.isPending && (
                <LoaderCircle className="animate-spin" />
              )}
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
