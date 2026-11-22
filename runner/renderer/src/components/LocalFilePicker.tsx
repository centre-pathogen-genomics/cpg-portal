import { Check, Plus, UploadCloud, XIcon } from "lucide-react"
import { type DragEvent, useState } from "react"
import { toast } from "sonner"
import type { Param } from "@/client"
import { Button } from "@/components/ui/button"
import { fileName } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { FileTypesMap } from "../contracts"
import { filePathOf, pickFiles } from "../lib/desktop"

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
 * Which of the param's allowed file types the picked files actually belong to
 * (longest extension match wins). Empty when the param does not restrict the
 * type set, so there is nothing to report.
 */
function detectedTypesOf(
  values: string[],
  param: Param,
  fileTypes: FileTypesMap,
): string[] {
  const allowed = (param.allowed_file_types ?? []).filter(
    (type) => fileTypes[type] !== undefined,
  )
  if (allowed.length === 0) return []
  const detected: string[] = []
  for (const path of values) {
    const lowered = fileName(path).toLowerCase()
    let best: string | null = null
    let bestLength = 0
    for (const type of allowed) {
      for (const extension of fileTypes[type].extensions) {
        const candidate = extension.toLowerCase()
        if (lowered.endsWith(candidate) && candidate.length > bestLength) {
          best = type
          bestLength = candidate.length
        }
      }
    }
    if (best !== null && !detected.includes(best)) detected.push(best)
  }
  return detected
}

type MateTag = {
  side: 1 | 2
  family: "r" | "n" | "w"
  label: string
}

/**
 * A conservative paired-read marker from an obvious filename pattern: r1/r2,
 * _1/_2, forward/reverse, fwd/rev. Only boundary-delimited tokens count, so
 * "reads1.fastq" is left alone but "reads_R1.fastq" and "reads_1.fastq" are
 * tagged. The family keeps mates together so an R1/R2 file never pairs with a
 * _1/_2 file.
 */
function mateTagOf(path: string): MateTag | null {
  const stem = fileName(path).toLowerCase().replace(/\.[^.]+$/, "")
  const families: Array<{
    family: MateTag["family"]
    re: RegExp
    labels: [string, string]
  }> = [
    { family: "r", re: /(?:^|[._-])r([12])(?:$|[._-])/, labels: ["R1", "R2"] },
    { family: "n", re: /(?:^|[._-])_?([12])(?:$|[._-])/, labels: ["_1", "_2"] },
    {
      family: "w",
      re: /(?:^|[._-])(forward|reverse|fwd|rev)(?:$|[._-])/,
      labels: ["forward", "reverse"],
    },
  ]
  for (const { family, re, labels } of families) {
    const match = re.exec(stem)
    if (match) {
      const token = match[1]
      const side: 1 | 2 =
        token === "1" || token === "forward" || token === "fwd" ? 1 : 2
      return { family, side, label: labels[side - 1] }
    }
  }
  return null
}

/**
 * Whether the param's own description/name or its allowed file types advertise
 * paired reads. Only then are pairing hints worth showing.
 */
function suggestsPairedReads(param: Param): boolean {
  if ((param.allowed_file_types ?? []).includes("pair")) return true
  const haystack = `${param.name} ${param.description ?? ""}`.toLowerCase()
  return /\b(pair|paired|mate|r1|r2|fwd|rev|forward|reverse)\b/.test(haystack)
}

type PairAnalysis = {
  pairs: number
  pairLabel: string | null
  missingMates: string[]
}

/**
 * Counts complete read pairs among the picked files and names any tagged file
 * whose mate is missing. Only runs when the param asks for multiple files and
 * suggests paired reads.
 */
function analyzePairs(values: string[], param: Param): PairAnalysis | null {
  if (param.multiple !== true || !suggestsPairedReads(param)) return null
  const byFamily = new Map<MateTag["family"], { side1: string[]; side2: string[] }>()
  let tagged = 0
  for (const path of values) {
    const tag = mateTagOf(path)
    if (tag === null) continue
    tagged++
    const bucket = byFamily.get(tag.family) ?? { side1: [], side2: [] }
    if (tag.side === 1) bucket.side1.push(path)
    else bucket.side2.push(path)
    byFamily.set(tag.family, bucket)
  }
  if (tagged === 0) return null
  const labelOf: Record<MateTag["family"], [string, string]> = {
    r: ["R1", "R2"],
    n: ["_1", "_2"],
    w: ["forward", "reverse"],
  }
  let pairs = 0
  const familiesWithPairs: string[] = []
  const missingMates: string[] = []
  for (const [family, bucket] of byFamily) {
    const matched = Math.min(bucket.side1.length, bucket.side2.length)
    if (matched > 0) {
      pairs += matched
      familiesWithPairs.push(labelOf[family].join("/"))
    }
    const labels = labelOf[family]
    for (const path of bucket.side1.slice(matched)) {
      missingMates.push(`${fileName(path)}: missing ${labels[1]} mate`)
    }
    for (const path of bucket.side2.slice(matched)) {
      missingMates.push(`${fileName(path)}: missing ${labels[0]} mate`)
    }
  }
  return {
    pairs,
    pairLabel:
      pairs === 1 && familiesWithPairs.length === 1
        ? `${familiesWithPairs[0]} pair detected`
        : pairs > 1
          ? `${pairs} read pairs detected`
          : null,
    missingMates,
  }
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
  // Files the user tried to add whose extension does not match the param, so
  // they never entered `values`. Shown inline instead of only as a toast.
  const [rejected, setRejected] = useState<string[]>([])
  const extensions = extensionsFor(param, fileTypes)
  const multiple = param.multiple === true
  const countLabel =
    values.length === 1 ? "1 file selected" : `${values.length} files selected`
  const detected = detectedTypesOf(values, param, fileTypes)
  const pairing = analyzePairs(values, param)

  function rememberRejected(paths: string[]) {
    if (paths.length === 0) return
    setRejected((previous) => {
      const next = [...previous]
      for (const path of paths) {
        if (!next.includes(path)) next.push(path)
      }
      return next
    })
  }

  function acceptPaths(candidates: string[]) {
    if (candidates.length === 0) return
    const accepted = candidates.filter((candidate) =>
      matchesExtensions(candidate, extensions),
    )
    const unsupported = candidates.filter(
      (candidate) => !accepted.includes(candidate),
    )
    if (accepted.length === 0) {
      rememberRejected(unsupported)
      toast.error("That file type is not supported")
      return
    }
    if (multiple) {
      const next = [...values]
      for (const acceptedPath of accepted) {
        if (!next.includes(acceptedPath)) next.push(acceptedPath)
      }
      onChange(next)
      if (unsupported.length > 0) {
        rememberRejected(unsupported)
        toast.error("Some files are not supported")
      }
      return
    }
    rememberRejected(unsupported)
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
          "rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm transition-colors hover:border-primary/60 hover:bg-primary/5",
          dragOver && "border-primary bg-primary/10",
          disabled && "opacity-50",
        )}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={drop}
      >
        <UploadCloud className="text-muted-foreground mx-auto mb-1 size-5" />
        <p className="font-medium">
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
        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-muted-foreground text-xs">{countLabel}</p>
            {detected.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Detected: {detected.join(", ")}
              </p>
            )}
          </div>
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
                  onClick={() => {
                    const next = values.filter((item) => item !== path)
                    if (next.length === 0) setRejected([])
                    onChange(next)
                  }}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
          {pairing?.pairLabel && (
            <p className="text-primary/80 flex items-center gap-1 text-xs">
              <Check className="size-3.5" />
              {pairing.pairLabel}
            </p>
          )}
          {pairing && pairing.missingMates.length > 0 && (
            <p className="text-muted-foreground text-xs">
              {pairing.missingMates.join(" · ")}
            </p>
          )}
        </div>
      )}
      {rejected.length > 0 && (
        <ul className="grid gap-0.5">
          {rejected.map((path) => (
            <li key={path} className="text-destructive/75 text-xs">
              {fileName(path)}: unsupported extension — expected{" "}
              {extensions.join(", ") || "an allowed extension"}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
