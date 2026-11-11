import { useEffect, useRef, useState } from "react"
import RenderMarkdown from "@/components/Common/Markdown"
import { Button } from "@/components/ui/button"
import { humanReadableFileSize } from "@/utils"
import { api, errorMessage } from "../api"
import type { RunFile } from "../contracts"
import { openPath, revealPath } from "../lib/desktop"
import { extensionOf, fileName } from "../lib/format"

const TEXT_EXTENSIONS: Record<string, true> = {
  ".txt": true,
  ".log": true,
  ".csv": true,
  ".tsv": true,
  ".json": true,
  ".md": true,
  ".fasta": true,
  ".fa": true,
  ".fna": true,
  ".gb": true,
  ".gbk": true,
  ".newick": true,
  ".nwk": true,
}

const IMAGE_EXTENSIONS: Record<string, true> = {
  ".png": true,
  ".jpg": true,
  ".jpeg": true,
  ".svg": true,
}

const PREVIEW_LIMIT = 200_000

type Preview =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "text"
      format: "json" | "markdown" | "table" | "plain"
      content: string
    }
  | { status: "image"; url: string }

function tableRows(content: string): string[][] {
  const delimiter = content.includes("\t") ? "\t" : ","
  return content
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .slice(0, 100)
    .map((line) => line.split(delimiter))
}

function PreviewBody({ preview }: { preview: Preview }) {
  if (preview.status === "loading") {
    return <p className="text-muted-foreground text-sm">Loading preview…</p>
  }
  if (preview.status === "error") {
    return <p className="text-destructive text-sm">{preview.message}</p>
  }
  if (preview.status === "image") {
    return (
      <img
        src={preview.url}
        alt="Output preview"
        className="max-h-80 max-w-full rounded border object-contain"
      />
    )
  }
  if (preview.format === "markdown") {
    return (
      <div className="max-h-80 overflow-auto rounded border p-3">
        <RenderMarkdown markdown={preview.content} />
      </div>
    )
  }
  if (preview.format === "table") {
    const rows = tableRows(preview.content)
    const [header = [], ...body] = rows
    return (
      <div className="max-h-80 overflow-auto rounded border">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {header.map((cell, index) => (
                <th
                  // biome-ignore lint/suspicious/noArrayIndexKey: header cells have no id
                  key={`${index}-${cell}`}
                  className="bg-muted border-b px-2 py-1 text-left font-medium"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row.join("\t")}`}>
                {row.map((cell, cellIndex) => (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: table cells have no id
                    key={`${cellIndex}-${cell}`}
                    className="border-b px-2 py-1"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <pre className="max-h-80 overflow-auto rounded border p-3 font-mono text-xs whitespace-pre-wrap">
      {preview.content}
    </pre>
  )
}

export function RunOutputs({
  runId,
  files,
}: {
  runId: string
  files: RunFile[]
}) {
  const [previews, setPreviews] = useState<Map<number, Preview>>(
    () => new Map(),
  )
  const objectUrls = useRef<string[]>([])

  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url)
      objectUrls.current = []
    },
    [],
  )

  function clearPreview(index: number) {
    const current = previews.get(index)
    if (current?.status === "image") URL.revokeObjectURL(current.url)
    setPreviews((previous) => {
      const next = new Map(previous)
      next.delete(index)
      return next
    })
  }

  async function togglePreview(file: RunFile, index: number) {
    if (previews.has(index)) {
      clearPreview(index)
      return
    }
    setPreviews((previous) =>
      new Map(previous).set(index, { status: "loading" }),
    )
    try {
      const blob = await api.blob(`/runs/${runId}/files/${index}`)
      const extension = extensionOf(file.name)
      if (IMAGE_EXTENSIONS[extension]) {
        const url = URL.createObjectURL(blob)
        objectUrls.current.push(url)
        setPreviews((previous) =>
          new Map(previous).set(index, { status: "image", url }),
        )
        return
      }
      if (!TEXT_EXTENSIONS[extension]) {
        throw new Error("Preview is not available for this file type")
      }
      let content = await blob.text()
      if (content.length > PREVIEW_LIMIT) {
        content = `${content.slice(0, PREVIEW_LIMIT)}\n… (preview truncated)`
      }
      let format: "json" | "markdown" | "table" | "plain" = "plain"
      if (extension === ".md") {
        format = "markdown"
      } else if (extension === ".csv" || extension === ".tsv") {
        format = "table"
      } else if (extension === ".json") {
        format = "json"
        try {
          content = JSON.stringify(JSON.parse(content), null, 2)
        } catch {
          format = "plain"
        }
      }
      setPreviews((previous) =>
        new Map(previous).set(index, { status: "text", format, content }),
      )
    } catch (error) {
      setPreviews((previous) =>
        new Map(previous).set(index, {
          status: "error",
          message: errorMessage(error),
        }),
      )
    }
  }

  if (files.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No output files were recorded for this run.
      </p>
    )
  }

  return (
    <ul className="grid gap-3">
      {files.map((file, index) => {
        const extension = extensionOf(file.name)
        const canPreview =
          TEXT_EXTENSIONS[extension] === true ||
          IMAGE_EXTENSIONS[extension] === true
        const preview = previews.get(index)
        return (
          <li key={`${file.path}-${index}`} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm" title={file.path}>
                  {fileName(file.path)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {humanReadableFileSize(file.size)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openPath(file.path)}
                >
                  Open
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => revealPath(file.path)}
                >
                  Show in folder
                </Button>
                {canPreview && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void togglePreview(file, index)}
                  >
                    {preview ? "Hide preview" : "Preview"}
                  </Button>
                )}
              </div>
            </div>
            {preview && (
              <div className="mt-3">
                <PreviewBody preview={preview} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
