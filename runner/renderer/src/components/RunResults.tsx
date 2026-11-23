import FileRenderer, { canRenderFile } from "@/components/Render/FileRenderer"
import {
  type FileLoader,
  FileLoaderProvider,
} from "@/components/Render/fileSource"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fileName } from "@/lib/format"
import { api } from "../api"
import type { RunFile } from "../contracts"

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
    .filter(({ file }) => canRenderFile({ file_type: file.file_type }))
  if (renderable.length === 0) {
    if (files.length === 0) return null
    return (
      <p className="text-muted-foreground text-sm">
        No preview is available for these files yet — open one from the Files
        section.
      </p>
    )
  }

  // The index names the output in this run's API, and the key carries the run
  // with it so the app-wide query cache never serves one run's file to another.
  const keyOf = (index: number) => `${runId}:${index}`
  const loader: FileLoader = (target) =>
    api.blob(
      `/runs/${runId}/files/${Number(target.key.slice(runId.length + 1))}`,
    )

  return (
    <section className="grid min-w-0 gap-3">
      <h2 className="text-lg font-semibold">Results</h2>
      <FileLoaderProvider loader={loader}>
        <Tabs defaultValue={renderable[0].file.path} className="min-w-0">
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
              <FileRenderer
                file={{
                  key: keyOf(index),
                  name: file.path,
                  file_type: file.file_type,
                  size: file.size,
                }}
              />
            </TabsContent>
          ))}
        </Tabs>
      </FileLoaderProvider>
    </section>
  )
}
