import { LoaderCircle } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { HiOutlineDocumentText, HiQuestionMarkCircle } from "react-icons/hi";
import { HiOutlineCommandLine } from "react-icons/hi2";
import { SiAnaconda } from "react-icons/si";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { RunPublic, RunStatus } from "../../client";
import CodeBlock from "../Common/CodeBlock";
import Markdown from "../Common/Markdown";
import RunProfiler from "./RunProfiler";

interface OutputAccordionItemProps {
  title: string;
  status: RunStatus;
  content: string | null;
  runId: string;
  /** Lines from a caller that runs its own stream, e.g. the desktop app. */
  logStream?: RunLogStream;
}

/**
 * Log lines a caller has already collected. Providing this keeps the component
 * from opening the portal's own log socket.
 */
export interface RunLogStream {
  lines: string[];
  status?: string;
}

const normalizeLogSnapshot = (value: string | null | undefined) =>
  value ? value.replace(/\n+$/g, "") : null;

const appendLogLine = (
  previous: string | null,
  line: string,
): string | null => {
  const normalizedPrevious = normalizeLogSnapshot(previous);
  if (!normalizedPrevious) return line;
  return `${normalizedPrevious}\n${line}`;
};

const OutputAccordionItem = ({
  title,
  content,
  status,
  runId,
  logStream,
}: OutputAccordionItemProps) => {
  const [output, setOutput] = useState<string | null>(
    normalizeLogSnapshot(content),
  );
  const [currentStatus, setCurrentStatus] = useState(status);
  const streamed = logStream ? logStream.lines.join("\n") : null;
  const shown = logStream ? streamed : output;
  // An empty capture is no output, not a single blank line.
  const lineCount = shown && shown.trim() ? shown.trim().split("\n").length : 0;
  const queued = (logStream?.status ?? currentStatus) === "pending";
  const active = (logStream?.status ?? currentStatus) === "running" || queued;

  useEffect(() => {
    setOutput((previous) => {
      const normalizedContent = normalizeLogSnapshot(content);
      if (!normalizedContent) return previous || null;
      if (!active) return normalizedContent;
      if (!previous) return normalizedContent;
      return normalizedContent.length >= previous.length
        ? normalizedContent
        : previous;
    });
  }, [active, content]);

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  useWebSocket(`logs/${runId}`, {
    enabled: !logStream,
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.status === "string") setCurrentStatus(data.status);
        if (typeof data.stdout === "string") {
          setOutput(normalizeLogSnapshot(data.stdout));
          return;
        }
        if (typeof data.log === "string")
          setOutput((previous) => appendLogLine(previous, data.log));
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    },
  });

  return (
    <AccordionItem value="logs">
      <AccordionTrigger>
        <span className="flex items-center">
          <HiOutlineDocumentText />
          <span className="mx-2">{title}</span>
          {active && <LoaderCircle className="size-4 animate-spin" />}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {lineCount > 0 ? (
          <CodeBlock
            code={(logStream ? streamed : output) || ""}
            language="text"
            lineNumbers
            follow
            maxHeight="500px"
          />
        ) : queued ? (
          <p>Waiting for run to start...</p>
        ) : active ? (
          <p>Running...</p>
        ) : (
          <p>No output</p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

const OutputAccordion = ({
  run,
  logStream,
  resources,
}: {
  run: RunPublic;
  /** Lines the caller streams itself; without it the portal's socket is used. */
  logStream?: RunLogStream;
  /** Extra accordion content, e.g. the resource charts. */
  resources?: ReactNode;
}) => (
  <Accordion type="multiple" defaultValue={["logs"]} className="mb-4 break-all">
    {run.tool.explanation_of_results_markdown && (
      <AccordionItem value="explanation">
        <AccordionTrigger>
          <span className="flex items-center">
            <HiQuestionMarkCircle />
            <span className="ml-2">Explanation of Results</span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <Markdown markdown={run.tool.explanation_of_results_markdown} />
        </AccordionContent>
      </AccordionItem>
    )}
    <OutputAccordionItem
      title="Tool Logs"
      content={run.stdout || null}
      status={run.status}
      runId={run.id}
      logStream={logStream}
    />
    <AccordionItem value="command">
      <AccordionTrigger>
        <span className="flex items-center">
          <HiOutlineCommandLine />
          <span className="ml-2">Command</span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <CodeBlock
          code={run.command ?? "This shouldn't happen..."}
          language="bash"
          lineNumbers={false}
        />
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="environment">
      <AccordionTrigger>
        <span className="flex items-center">
          <SiAnaconda />
          <span className="ml-2">Environment</span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {run.conda_env_pinned ? (
          <CodeBlock
            code={run.conda_env_pinned}
            language="yaml"
            lineNumbers={false}
          />
        ) : (
          <p>No environment</p>
        )}
      </AccordionContent>
    </AccordionItem>
    {resources}
  </Accordion>
);

export default OutputAccordion;
