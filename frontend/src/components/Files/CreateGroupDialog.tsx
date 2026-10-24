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
import { FilesService, type FileTypeEnum } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

// The backend refuses a group larger than this.
const MAX_FILES_IN_GROUP = 1000

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

export interface GroupFilters {
  types?: string[]
  name?: string
}

interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The files to group when grouping a selection. */
  selectedFileIds?: string[]
  /**
   * Group every file matching these filters instead, so a whole filtered list
   * can be grouped in one go.
   */
  matchingFilters?: GroupFilters
  /** How many files the group will hold, for the prompt. */
  groupSize: number
  onGroupCreated?: () => void
}

export default function CreateGroupDialog({
  open,
  onOpenChange,
  selectedFileIds = [],
  matchingFilters,
  groupSize,
  onGroupCreated,
}: CreateGroupDialogProps) {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const createGroup = useMutation({
    mutationFn: async () => {
      let ids = selectedFileIds
      if (matchingFilters) {
        // Every file the filters match, not only the page on screen.
        const matching = await FilesService.readFiles({
          query: {
            skip: 0,
            limit: MAX_FILES_IN_GROUP,
            ...(matchingFilters.types?.length
              ? { types: matchingFilters.types as FileTypeEnum[] }
              : {}),
            ...(matchingFilters.name ? { name: matchingFilters.name } : {}),
          },
        })
        ids = (matching.data?.data ?? []).map((file) => file.id)
      }
      return FilesService.createGroup({
        body: ids,
        query: { name: name.trim() },
      })
    },
    onSuccess: () => {
      showToast("Success", "Group created successfully.", "success")
      setName("")
      setError(null)
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: ["files"] })
      queryClient.invalidateQueries({ queryKey: ["files-count"] })
      queryClient.invalidateQueries({ queryKey: [{ _id: "getFilesStats" }] })
      onGroupCreated?.()
    },
    onError: (requestError: unknown) => {
      const message =
        errorDetail(requestError) ??
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
    createGroup.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create File Group</DialogTitle>
        </DialogHeader>
        <p>Enter a name for the group of {groupSize} files:</p>
        <Input
          placeholder="Group name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && create()}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={create}
            disabled={!name.trim() || createGroup.isPending}
          >
            {createGroup.isPending && <LoaderCircle className="animate-spin" />}
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { MAX_FILES_IN_GROUP }
