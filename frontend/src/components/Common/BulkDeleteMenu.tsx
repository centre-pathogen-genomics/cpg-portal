import { MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmationDialog } from "./ConfirmationDialog"

export type BulkDeleteMode = "selected" | "current" | "all"

interface BulkDeleteMenuProps {
  allCount: number
  confirmLabel: string
  currentCount: number
  descriptionNoun: string
  descriptionSuffix?: string
  mode: BulkDeleteMode | null
  onConfirm: () => void
  onModeChange: (mode: BulkDeleteMode | null) => void
  pending: boolean
  selectedCount?: number
  titleNoun: string
  triggerAriaLabel: string
}

export function BulkDeleteMenu({
  allCount,
  confirmLabel,
  currentCount,
  descriptionNoun,
  descriptionSuffix = "",
  mode,
  onConfirm,
  onModeChange,
  pending,
  selectedCount = 0,
  titleNoun,
  triggerAriaLabel,
}: BulkDeleteMenuProps) {
  const deleteCount =
    mode === "selected"
      ? selectedCount
      : mode === "current"
        ? currentCount
        : allCount
  const title =
    mode === "selected"
      ? `Delete Selected ${titleNoun}`
      : mode === "current"
        ? `Delete Visible ${titleNoun}`
        : `Delete All ${titleNoun}`
  const actionLabel =
    mode === "selected"
      ? "Delete Selected"
      : mode === "current"
        ? "Delete Visible"
        : "Delete All"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={triggerAriaLabel}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {selectedCount > 0 && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onModeChange("selected")}
            >
              Delete Selected ({selectedCount})
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            disabled={currentCount === 0}
            onSelect={() => onModeChange("current")}
          >
            Delete Visible ({currentCount})
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={allCount === 0}
            onSelect={() => onModeChange("all")}
          >
            Delete All ({allCount})
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationDialog
        open={mode !== null}
        onOpenChange={(open) => !open && onModeChange(null)}
        title={title}
        description={`Are you sure you want to delete ${deleteCount} ${descriptionNoun}${
          deleteCount === 1 ? "" : "s"
        }${descriptionSuffix}? This action cannot be undone.`}
        confirmLabel={confirmLabel || actionLabel}
        pending={pending}
        onConfirm={onConfirm}
      />
    </>
  )
}
