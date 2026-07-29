import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { CopyToClipboard } from "react-copy-to-clipboard"
import { FiShare2 } from "react-icons/fi"
import {
  HiHashtag,
  HiOutlineLightningBolt,
  HiOutlineStatusOnline,
  HiOutlineTag,
} from "react-icons/hi"
import { HiCalendarDays, HiOutlineClock, HiOutlineUser } from "react-icons/hi2"
import { IoIosCheckmarkCircleOutline, IoIosCopy } from "react-icons/io"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { RunPublic } from "../../client"
import { humanReadableDateTime } from "../../utils"
import ParamTag from "./ParamTag"
import RunRuntime from "./RunTime"
import StatusBadge from "./StatusBadge"

function Parameters({ params }: { params: Record<string, any> }) {
  return (
    <div className="flex flex-wrap">
      {Object.keys(params)
        .filter((key) => params[key] !== null)
        .map((key) => (
          <div key={key} className="my-1 mr-1">
            <ParamTag param={key} value={params[key]} />
          </div>
        ))}
    </div>
  )
}

function RunMetadata({ run }: { run: RunPublic }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    toast.success("Run URL copied to clipboard!")
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const items: Array<{
    icon: React.ReactNode
    title: string
    value: React.ReactNode
  }> = [
    {
      icon: <HiOutlineStatusOnline />,
      title: "Status",
      value: <StatusBadge status={run.status} />,
    },
    {
      icon: <HiOutlineLightningBolt />,
      title: "Tool",
      value: (
        <button
          type="button"
          className="hover:underline"
          onClick={() =>
            navigate({
              to: "/tools/$name",
              params: { name: run.tool.name },
              resetScroll: true,
            })
          }
        >
          {run.tool.name}
        </button>
      ),
    },
    {
      icon: <HiOutlineTag />,
      title: "Parameters",
      value: <Parameters params={run.params} />,
    },
    {
      icon: <HiCalendarDays />,
      title: "Started",
      value: humanReadableDateTime(run.started_at || ""),
    },
    {
      icon: <HiOutlineClock />,
      title: "Runtime",
      value: (
        <RunRuntime
          started_at={run.started_at ?? null}
          finished_at={run.finished_at ?? null}
          status={run.status}
        />
      ),
    },
  ]

  if (run.shared)
    items.push({
      icon: <FiShare2 />,
      title: "Shared",
      value: (
        <div className="flex items-center">
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            Anyone
          </Badge>
          <CopyToClipboard text={window.location.href} onCopy={copy}>
            <Button
              aria-label="Copy run URL to clipboard"
              size="icon-sm"
              variant="ghost"
            >
              {copied ? (
                <IoIosCheckmarkCircleOutline className="text-green-600" />
              ) : (
                <IoIosCopy className="text-gray-500" />
              )}
            </Button>
          </CopyToClipboard>
        </div>
      ),
    })
  if (run.shared && run.owner_name)
    items.push({
      icon: <HiOutlineUser />,
      title: "Owner",
      value: <span>{run.owner_name}</span>,
    })
  if (run.tags?.length)
    items.push({
      icon: <HiHashtag />,
      title: "Tags",
      value: (
        <>
          {run.tags.map((tag) => (
            <Badge
              key={tag}
              className="mr-1 bg-cyan-100 text-cyan-800 hover:bg-cyan-100"
            >
              {tag}
            </Badge>
          ))}
        </>
      ),
    })

  return (
    <div className="flex flex-col">
      {items.map(({ icon, title, value }) => (
        <div key={title} className="mb-3 flex items-start">
          <div className="w-32 shrink-0">
            <div className="flex items-center">
              {icon}
              <span className="ml-2">{title}</span>
            </div>
          </div>
          <div className="flex items-center">{value}</div>
        </div>
      ))}
    </div>
  )
}

export default RunMetadata
