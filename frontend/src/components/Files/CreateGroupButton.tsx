import { useState } from "react"
import { Button } from "@/components/ui/button"
import CreateGroupDialog, { type GroupFilters } from "./CreateGroupDialog"

interface CreateGroupButtonProps {
  selectedFileIds: string[]
  /**
   * When no file is selected, group everything these filters match instead.
   * Without a selection and without filters there is nothing to group.
   */
  matchingFilters?: GroupFilters
  matchingCount?: number
  onGroupCreated?: () => void
  className?: string
  size?: "xs" | "sm" | "md" | "lg"
}

export default function CreateGroupButton({
  selectedFileIds,
  matchingFilters,
  matchingCount = 0,
  onGroupCreated,
  className,
  size = "md",
}: CreateGroupButtonProps) {
  const [open, setOpen] = useState(false)
  // A selection is grouped; otherwise the filters decide what a group would
  // hold.
  const groupingAll =
    selectedFileIds.length === 0 && matchingFilters !== undefined
  const groupSize = groupingAll ? matchingCount : selectedFileIds.length

  if (groupSize === 0) {
    return null
  }

  return (
    <>
      <Button
        className={className}
        size={size === "md" ? "default" : size === "xs" ? "sm" : size}
        onClick={() => setOpen(true)}
      >
        {groupingAll
          ? `Group All (${groupSize})`
          : `Group Selected (${groupSize})`}
      </Button>
      <CreateGroupDialog
        open={open}
        onOpenChange={setOpen}
        selectedFileIds={groupingAll ? undefined : selectedFileIds}
        matchingFilters={groupingAll ? matchingFilters : undefined}
        groupSize={groupSize}
        onGroupCreated={onGroupCreated}
      />
    </>
  )
}
