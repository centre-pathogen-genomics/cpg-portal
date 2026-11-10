import type { Param } from "@/client"
import { Plus, XIcon } from "lucide-react"
import { useState, type DragEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { filePathOf, pickFiles } from "../lib/desktop"
import { fileName } from "../lib/format"
import type { FileTypesMap } from "../contracts"

function extensionsFor(param: Param, fileTypes: FileTypesMap): string[] {
  return (param.allowed_file_types ?? []).flatMap(
    (type) => fileTypes[type]?.extensions ?? [],
  )
}

function matchesExtensions(candidate: string, extensions: string[]): boolean {
  if (extensions.length === 0) return true
  const lowered = candidate.toLowerCase()
  return extensions.some((extension) => lowered.endsWith(extension.toLowerCase()))
}

function FileField({
  param,
  paths,
  fileTypes,
  disabled,
  onChange,
}: {
  param: Param
  paths: string[]
  fileTypes: FileTypesMap
  disabled: boolean
  onChange: (paths: string[]) => void
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
      const next = [...paths]
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
      Array.from(event.dataTransfer.files)
        .map(filePathOf)
        .filter(Boolean),
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
          {paths.length === 0
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
      {paths.length > 0 && (
        <ul className="grid gap-1">
          {paths.map((path) => (
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
                onClick={() => onChange(paths.filter((item) => item !== path))}
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

export function LocalParamsForm({
  params,
  values,
  visible,
  fileTypes,
  errors,
  disabled,
  onChange,
}: {
  params: Param[]
  values: Record<string, unknown>
  visible: Map<string, boolean>
  fileTypes: FileTypesMap
  errors: Record<string, string>
  disabled: boolean
  onChange: (name: string, value: unknown) => void
}) {
  return (
    <div className="grid gap-5">
      {params.map((param) => {
        if (visible.get(param.name) === false) return null
        const value = values[param.name]
        const textValue =
          value === null || value === undefined ? "" : String(value)
        const error = errors[param.name]
        return (
          <div key={param.name} className="grid gap-1.5">
            <Label htmlFor={param.name}>{param.name}</Label>
            {param.description && param.param_type !== "bool" && (
              <p className="text-muted-foreground text-xs">
                {param.description}
              </p>
            )}

            {(param.param_type === "str" ||
              param.param_type === "int" ||
              param.param_type === "float") && (
              <Input
                id={param.name}
                type={param.param_type === "str" ? "text" : "number"}
                step={param.param_type === "float" ? "any" : undefined}
                disabled={disabled}
                value={textValue}
                onChange={(event) => {
                  const raw = event.target.value
                  if (param.param_type === "str") {
                    onChange(param.name, raw)
                    return
                  }
                  if (raw === "") {
                    onChange(param.name, "")
                    return
                  }
                  const parsed =
                    param.param_type === "int"
                      ? Number.parseInt(raw, 10)
                      : Number.parseFloat(raw)
                  if (!Number.isNaN(parsed)) onChange(param.name, parsed)
                }}
              />
            )}

            {param.param_type === "enum" && (
              <Select
                value={textValue}
                disabled={disabled}
                onValueChange={(next) => onChange(param.name, next)}
              >
                <SelectTrigger id={param.name} className="w-full">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {(param.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {param.param_type === "bool" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={param.name}
                  disabled={disabled}
                  checked={value === true}
                  onCheckedChange={(checked) =>
                    onChange(param.name, checked === true)
                  }
                />
                <Label htmlFor={param.name} className="font-normal">
                  {param.description || "Check to enable"}
                </Label>
              </div>
            )}

            {param.param_type === "file" && (
              <FileField
                param={param}
                paths={(value as string[] | undefined) ?? []}
                fileTypes={fileTypes}
                disabled={disabled}
                onChange={(paths) => onChange(param.name, paths)}
              />
            )}

            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
        )
      })}
    </div>
  )
}
