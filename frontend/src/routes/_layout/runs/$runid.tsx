import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { readRunOptions } from "../../../client/@tanstack/react-query.gen"
import AISummaryButton from "../../../components/AI/AISummary"
import ReactMarkdown from "../../../components/Common/Markdown"
import FileRenderer from "../../../components/Render/FileRenderer"
import CancelRunButton from "../../../components/Runs/CancelRunButton"
import DeleteRunButton from "../../../components/Runs/DeleteRunButton"
import EditRunName from "../../../components/Runs/EditableRunName"
import OutputAccordion from "../../../components/Runs/OutputAccordion"
import OutputFile from "../../../components/Runs/OutputFile"
import RunMetadata from "../../../components/Runs/RunMetadata"
import ShareRunButton from "../../../components/Runs/ShareRunButton"

export const Route = createFileRoute("/_layout/runs/$runid")({ component: Run })

function RunDetail() {
  const { runid } = Route.useParams()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: run } = useSuspenseQuery({
    ...readRunOptions({ path: { id: runid } }),
    refetchInterval: (query) =>
      ["running", "pending"].includes(query.state.data?.status || "")
        ? 3000
        : false,
    refetchIntervalInBackground: true,
  })
  const [llmSummary, setLlmSummary] = useState<string | null>(
    run.llm_summary || null,
  )
  const fileTabs =
    run.files?.filter((file) => file.size && file.size < 500000) || []
  const firstTab =
    run.tool.llm_summary_enabled && llmSummary ? "llm_summary" : fileTabs[0]?.id

  return (
    <div className="w-full max-w-5xl justify-self-center overflow-x-hidden px-2">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/runs"
          className="flex items-center whitespace-nowrap font-semibold hover:text-primary"
        >
          ← Back to My Runs
        </Link>
        <div className="flex items-center gap-2">
          {!run.owner_name && <ShareRunButton run={run} />}
          {["running", "pending"].includes(run.status) ? (
            <CancelRunButton run_id={run.id} />
          ) : (
            <DeleteRunButton
              run_id={run.id}
              onDelete={() => navigate({ to: "/runs" })}
            />
          )}
        </div>
      </div>
      <div className="mt-1 mb-2 flex items-start border-b">
        <EditRunName run={run} editable={!run.owner_name} />
      </div>
      <div className="my-4">
        <RunMetadata run={run} />
      </div>
      {run.files.length > 0 && (
        <>
          <h2 className="mb-4 text-lg font-semibold">Files</h2>
          <div className="mb-4 flex flex-nowrap overflow-x-auto">
            {run.files.map((file) => (
              <div key={file.id} className="mr-2 mb-2">
                <OutputFile file={file} copyFile={!!run.owner_name} />
              </div>
            ))}
          </div>
          {fileTabs.length > 0 && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Results</h2>
                {run.tool.llm_summary_enabled &&
                  !llmSummary &&
                  !run.owner_name && (
                    <AISummaryButton
                      runId={run.id}
                      onGenerated={setLlmSummary}
                    />
                  )}
              </div>
              <Tabs defaultValue={firstTab} className="overflow-y-auto">
                <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
                  {run.tool.llm_summary_enabled && llmSummary && (
                    <TabsTrigger value="llm_summary">AI Summary</TabsTrigger>
                  )}
                  {fileTabs.map((file) => (
                    <TabsTrigger value={file.id} key={file.id}>
                      {file.name.toLocaleUpperCase()}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {run.tool.llm_summary_enabled && llmSummary && (
                  <TabsContent value="llm_summary" className="p-4">
                    <p className="mb-2 text-sm font-bold text-destructive">
                      Large Language Models (AI) are prone to hallucinations and
                      mistakes. Please use with caution.
                    </p>
                    <ReactMarkdown markdown={llmSummary} />
                  </TabsContent>
                )}
                {fileTabs.map((file) => (
                  <TabsContent value={file.id} key={file.id} className="p-4">
                    <FileRenderer
                      file={file}
                      showUnsupportedMessage={false}
                      showTooLargeMessage={false}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </>
      )}
      <OutputAccordion run={run} />
    </div>
  )
}

function Run() {
  return (
    <div className="w-full">
      <Suspense fallback={<Skeleton className="h-5" />}>
        <ErrorBoundary
          fallbackRender={({ error }) => (
            <div>
              Error: {error instanceof Error ? error.message : String(error)}
            </div>
          )}
        >
          <RunDetail />
        </ErrorBoundary>
      </Suspense>
    </div>
  )
}

export default Run
