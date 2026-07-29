import { LoaderCircle } from "lucide-react"
import { useState } from "react"
import { HiOutlineDocumentText, HiQuestionMarkCircle } from "react-icons/hi"
import { HiOutlineCommandLine } from "react-icons/hi2"
import { SiAnaconda } from "react-icons/si"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { RunPublic } from "../../client"
import useWebSocket from "../../hooks/useWebsocket"
import CodeBlock from "../Common/CodeBlock"
import Markdown from "../Common/Markdown"

interface OutputAccordionItemProps {
  title: string
  status: string
  content: string | null
  runId: string
}

const OutputAccordionItem = ({
  title,
  content,
  status,
  runId,
}: OutputAccordionItemProps) => {
  const [output, setOutput] = useState<string | null>(content || null)
  const lineCount = output?.trim().split("\n").length || 0
  const active = status === "running" || status === "pending"

  useWebSocket(`logs/${runId}`, {
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.log)
          setOutput((previous) =>
            [previous, data.log].filter(Boolean).join("\n"),
          )
      } catch (error) {
        console.error("Error parsing WebSocket message:", error)
      }
    },
  })

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
        ) : active ? (
          <p>Running...</p>
        ) : (
          <p>No output</p>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

const OutputAccordion = ({ run }: { run: RunPublic }) => (
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
      content={run.stdout || null}
      status={run.status}
      runId={run.id}
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
  </Accordion>
)

export default OutputAccordion
