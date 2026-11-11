import { useEffect, useState } from "react"
import RenderMarkdown from "@/components/Common/Markdown"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, errorMessage } from "../api"
import type { RunFile } from "../contracts"
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

export function canPreview(name: string): boolean {
  const extension = extensionOf(name)
  return TEXT_EXTENSIONS[extension] === true || IMAGE_EXTENSIONS[extension] === true
}

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
        className="max-h-96 max-w-full rounded border object-contain"
      />
    )
  }
  if (preview.format === "markdown") {
    return (
      <div className="max-h-96 overflow-auto rounded border p-3">
        <RenderMarkdown markdown={preview.content} />
      </div>
    )
  }
  if (preview.format === "table") {
    const rows = tableRows(preview.content)
    const [header = [], ...body] = rows
    return (
      <div className="max-h-96 overflow-auto rounded border">
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
    <pre className="max-h-96 overflow-auto rounded border p-3 font-mono text-xs whitespace-pre-wrap">
      {preview.content}
    </pre>
  )
}

/** One file's content, fetched when its tab is shown. */
async function loadPreview(
  runId: string,
  file: RunFile,
  index: number,
): Promise<Preview | { url: string }> {
  const blob = await api.blob(`/runs/${runId}/files/${index}`)
  const extension = extensionOf(file.name)
  if (IMAGE_EXTENSIONS[extension]) {
    return { url: URL.createObjectURL(blob) }
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
  return { status: "text", format, content }
}

function FilePreview({
  runId,
  file,
  index,
}: {
  runId: string
  file: RunFile
  index: number
}) {
  const [preview, setPreview] = useState<Preview>({ status: "loading" })

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    void loadPreview(runId, file, index)
      .then((loaded) => {
        if (cancelled) {
          if ("url" in loaded) URL.revokeObjectURL(loaded.url)
          return
        }
        if ("url" in loaded) {
          url = loaded.url
          setPreview({ status: "image", url: loaded.url })
          return
        }
        setPreview(loaded as Preview)
      })
      .catch((error) => {
        if (!cancelled) {
          setPreview({ status: "error", message: errorMessage(error) })
        }
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [runId, file, index])

  return <PreviewBody preview={preview} />
}

/**
 * The content of the files the run produced, in tabs, like the portal's
 * Results section: a file type that cannot be drawn gets no tab.
 */
export function RunResults({
  runId,
  files,
}: {
  runId: string
  files: RunFile[]
}) {
  const renderable = files
    .map((file, index) => ({ file, index }))
    .filter(({ file }) => canPreview(file.name))
  if (renderable.length === 0) return null

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Results</h2>
      <Tabs defaultValue={renderable[0].file.path}>
        <TabsList
          variant="line"
          className="w-full justify-start overflow-x-auto [scrollbar-width:thin]"
        >
          {renderable.map(({ file }) => (
            <TabsTrigger value={file.path} key={file.path}>
              {fileName(file.path).toLocaleUpperCase()}
            </TabsTrigger>
          ))}
        </TabsList>
        {renderable.map(({ file, index }) => (
          <TabsContent value={file.path} key={file.path}>
            <FilePreview runId={runId} file={file} index={index} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}
