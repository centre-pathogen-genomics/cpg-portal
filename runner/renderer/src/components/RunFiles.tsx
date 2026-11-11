import { Button } from "@/components/ui/button"
import { humanReadableFileSize } from "@/utils"
import type { RunFile } from "../contracts"
import { openPath, revealPath } from "../lib/desktop"
import { fileName } from "../lib/format"

/**
 * What the run produced, one row per file, like the portal's Files section.
 * The content itself is shown next door, under Results.
 */
export function RunFiles({
  files,
  onOpenOutputFolder,
}: {
  files: RunFile[]
  onOpenOutputFolder?: () => void
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Files</h2>
        {onOpenOutputFolder && (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-sm font-normal"
            onClick={onOpenOutputFolder}
          >
            Open output folder
          </Button>
        )}
      </div>
      {files.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No output files were recorded for this run.
        </p>
      ) : (
        <ul className="grid gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.path}-${index}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
            >
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
