import { LayoutGrid, List, Table as TableIcon } from "lucide-react"
import type React from "react"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import type { ViewMode } from "../../hooks/useViewMode"

const MODES: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
  { mode: "cards", label: "Card view", icon: <LayoutGrid /> },
  { mode: "list", label: "List view", icon: <List /> },
  { mode: "table", label: "Table view", icon: <TableIcon /> },
]

/** The cards / list / table switch of a list of records. */
export default function ViewModeButtons({
  mode,
  onChange,
}: {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}) {
  return (
    <ButtonGroup>
      {MODES.map(({ mode: value, label, icon }) => (
        <Button
          key={value}
          type="button"
          size="icon"
          variant={mode === value ? "secondary" : "ghost"}
          aria-pressed={mode === value}
          aria-label={label}
          title={label}
          onClick={() => onChange(value)}
        >
          {icon}
        </Button>
      ))}
    </ButtonGroup>
  )
}
