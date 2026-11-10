import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** Entries in a permission description are joined with this separator by the
 * backend (`core/rbac.py`): one `function: docstring` per enforcing endpoint. */
const ENTRY_SEPARATOR = " · "

/**
 * A permission's description as one pill per enforcing endpoint. A pill shows
 * the first sentence of that endpoint's docstring; hovering reveals the rest.
 */
export function PermissionDescription({
  description,
}: {
  description: string
}) {
  const entries = description.split(ENTRY_SEPARATOR)

  return (
    <div className="flex flex-wrap gap-1">
      {entries.map((entry) => (
        <Tooltip key={entry}>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="max-w-full cursor-help font-normal"
            >
              <span className="min-w-0 truncate">{firstSentence(entry)}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-md whitespace-normal">
            {entry}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

/** The text up to and including the first sentence-ending period. */
function firstSentence(entry: string): string {
  return entry.match(/^.*?\.(?=\s|$)/)?.[0] ?? entry
}
