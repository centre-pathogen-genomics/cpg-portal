import { Plus, XIcon } from "lucide-react"
import { type DragEvent, useState } from "react"
import { toast } from "sonner"
import type { Param } from "@/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FileTypesMap } from "../contracts"
import { filePathOf, pickFiles } from "../lib/desktop"
import { fileName } from "@/lib/format"

function extensionsFor(param: Param, fileTypes: FileTypesMap): string[] {
  return (param.allowed_file_types ?? []).flatMap(
    (type) => fileTypes[type]?.extensions ?? [],
  )
}

function matchesExtensions(candidate: string, extensions: string[]): boolean {
  if (extensions.length === 0) return true
  const lowered = candidate.toLowerCase()
  return extensions.some((extension) =>
    lowered.endsWith(extension.toLowerCase()),
  )
}

/**
 * A file parameter on this computer: pick from disk or drop a file in. It is
 * the local counterpart of the portal's upload picker, handed to the shared
 * run form through its `local.renderFilePicker`.
 */
export function LocalFilePicker({
  param,
  values,
  fileTypes,
  disabled,
  onChange,
}: {
  param: Param
  values: string[]
  fileTypes: FileTypesMap
  disabled: boolean
  onChange: (values: string[]) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const extensions = extensionsFor(param, fileTypes)
  const multiple = param.multiple === true

  function acceptPaths(candidates: string[]) {
    if (candidates.length === 0) return
    const accepted = candidates.filter((candidate) =>
      matchesExtensions(candidate, extensions),
    )
    if (accepted.length === 0) {
      toast.error("That file type is not supported")
      return
    }
    if (multiple) {
      const next = [...values]
      for (const acceptedPath of accepted) {
        if (!next.includes(acceptedPath)) next.push(acceptedPath)
      }
      onChange(next)
      if (accepted.length < candidates.length) {
        toast.error("Some files are not supported")
      }
      return
    }
    if (candidates.length > 1) toast.info("Only one file is allowed here")
    onChange([accepted[0]])
  }

  async function choose() {
    const chosen = await pickFiles({ extensions, multiple })
    acceptPaths(chosen)
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    if (disabled) return
    acceptPaths(
      Array.from(event.dataTransfer.files).map(filePathOf).filter(Boolean),
    )
  }

  return (
    <div className="grid gap-2">
      <div
        className={cn(
          "rounded-md border border-dashed p-4 text-center text-sm transition-colors",
          dragOver && "border-primary bg-accent",
          disabled && "opacity-50",
        )}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={drop}
      >
        <p className="text-muted-foreground">
          {values.length === 0
            ? "Drop files here or choose from disk"
            : "Drop more files here"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={disabled}
          onClick={() => void choose()}
        >
          <Plus />
          Add files
        </Button>
      </div>
      {values.length > 0 && (
        <ul className="grid gap-1">
          {values.map((path) => (
            <li
              key={path}
              className="flex items-center justify-between gap-2 rounded border px-2 py-1"
            >
              <span className="truncate font-mono text-xs" title={path}>
                {fileName(path)}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={disabled}
                aria-label={`Remove ${fileName(path)}`}
                onClick={() => onChange(values.filter((item) => item !== path))}
              >
                <XIcon className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
