import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RunPublic } from "../../../client";
import { readRunOptions } from "../../../client/@tanstack/react-query.gen";
import AISummaryButton from "../../../components/AI/AISummary";
import ReactMarkdown from "../../../components/Common/Markdown";
import DownloadAllFilesButton from "../../../components/Files/DownloadAllFilesButton";
import FileRenderer, {
  canRenderFile,
} from "../../../components/Render/FileRenderer";
import CancelRunButton from "../../../components/Runs/CancelRunButton";
import DeleteRunButton from "../../../components/Runs/DeleteRunButton";
import EditRunName from "../../../components/Runs/EditableRunName";
import OutputAccordion from "../../../components/Runs/OutputAccordion";
import OutputFile from "../../../components/Runs/OutputFile";
import RerunRunButton from "../../../components/Runs/RerunRunButton";
import RunMetadata from "../../../components/Runs/RunMetadata";
import RunTimeline from "../../../components/Runs/RunTimeline";
import ShareRunButton from "../../../components/Runs/ShareRunButton";
import useAuth from "../../../hooks/useAuth";
import useRunLogs from "../../../hooks/useRunLogs";

export const Route = createFileRoute("/_layout/runs/$runid")({
  component: Run,
});

function RunDetailSkeleton() {
  return (
    <div className="w-full max-w-5xl space-y-4 justify-self-center px-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}

function RunDetail() {
  const { runid } = Route.useParams();
  const { data: run, isPending } = useQuery({
    ...readRunOptions({ path: { id: runid } }),
    refetchInterval: (query) =>
      ["running", "pending"].includes(query.state.data?.status || "")
        ? 3000
        : false,
    refetchIntervalInBackground: true,
    throwOnError: true,
  });

  if (isPending || !run) {
    return <RunDetailSkeleton />;
  }

  return <RunDetailContent run={run} />;
}

function RunDetailContent({ run }: { run: RunPublic }) {
  const navigate = useNavigate({ from: Route.fullPath });
  const { user } = useAuth();
  const [llmSummary, setLlmSummary] = useState<string | null>(
    run.llm_summary || null,
  );
  const { logs, status } = useRunLogs(run);
  // Sharing a run lets others read it, so ownership decides what is shown.
  const isOwner = run.owner_id === user?.id;
  // Every output the renderer can draw gets a tab; the renderer decides what
  // it can show, so size is not a reason to leave one out.
  const fileTabs = run.files?.filter(canRenderFile) ?? [];
  const firstTab =
    run.tool.llm_summary_enabled && llmSummary
      ? "llm_summary"
      : fileTabs[0]?.id;

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
          {isOwner && <ShareRunButton run={run} />}
          {isOwner && <RerunRunButton run={run} />}
          {isOwner &&
            (["running", "pending"].includes(run.status) ? (
              <CancelRunButton run_id={run.id} />
            ) : (
              <DeleteRunButton
                run_id={run.id}
                onDelete={() => navigate({ to: "/runs" })}
              />
            ))}
        </div>
      </div>
      <div className="mt-1 mb-2 flex items-start border-b">
        <EditRunName run={run} editable={isOwner} />
      </div>
      <div className="my-4">
        <RunMetadata run={run} />
      </div>
      <RunTimeline
        steps={run.tool.timeline ?? []}
        logs={logs}
        status={status}
      />
      {run.files.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Files</h2>
            <DownloadAllFilesButton
              files={run.files}
              zipFileName={run.name ?? run.id.split("-")[0]}
            />
          </div>
          <div className="mb-4 flex flex-nowrap overflow-x-auto">
            {run.files.map((file) => (
              <div key={file.id} className="mr-2 mb-2">
                <OutputFile file={file} copyFile={!isOwner} />
              </div>
            ))}
          </div>
          {fileTabs.length > 0 && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Results</h2>
                {run.tool.llm_summary_enabled && !llmSummary && isOwner && (
                  <AISummaryButton runId={run.id} onGenerated={setLlmSummary} />
                )}
              </div>
              <Tabs defaultValue={firstTab} className="overflow-y-auto">
                <TabsList
                  variant="line"
                  className="w-full justify-start overflow-x-auto pb-2 [scrollbar-width:thin]"
                >
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
                    <Suspense
                      fallback={<Skeleton className="h-[240px] w-full" />}
                    >
                      <FileRenderer
                        file={file}
                        showUnsupportedMessage={false}
                        showTooLargeMessage
                      />
                    </Suspense>
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </>
      )}
      <OutputAccordion run={run} resources={<RunProfiler run={run} />} />
      <OutputAccordion run={run} logs={logs} status={status} />
    </div>
  );
}

function Run() {
  return (
    <div className="w-full">
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <div>
            Error: {error instanceof Error ? error.message : String(error)}
          </div>
        )}
      >
        <RunDetail />
      </ErrorBoundary>
    </div>
  );
}

export default Run;
