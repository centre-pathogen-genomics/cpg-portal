import { LoaderCircle } from "lucide-react"
import { HiOutlineDocumentText, HiQuestionMarkCircle } from "react-icons/hi"
import { HiOutlineCommandLine } from "react-icons/hi2"
import { SiAnaconda } from "react-icons/si"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { RunPublic, RunStatus } from "../../client"
import CodeBlock from "../Common/CodeBlock"
import Markdown from "../Common/Markdown"
import RunProfiler from "./RunProfiler"

interface OutputAccordionItemProps {
  title: string
  status: RunStatus
  content: string | null
}

const OutputAccordionItem = ({
  title,
  content,
  status,
}: OutputAccordionItemProps) => {
  const output = content
  const lineCount = output?.trim().split("\n").length || 0
  const queued = status === "pending"
  const active = status === "running" || queued

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
            code={output || ""}
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
  )
}

const OutputAccordion = ({
  run,
  logs,
  status,
}: {
  run: RunPublic
  logs: string
  status: RunStatus
}) => (
  <Accordion type="multiple" className="mb-4 break-all">
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
      content={logs || null}
      status={status}
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
    <RunProfiler run={run} />
  </Accordion>
)

export default OutputAccordion
