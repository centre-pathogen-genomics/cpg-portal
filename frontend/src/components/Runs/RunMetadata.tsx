import {
  Badge,
  Flex,
  HStack,
  Icon,
  IconButton,
  Link,
  Text,
  useToast,
} from "@chakra-ui/react"
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
import type { RunPublic } from "../../client"
import { humanReadableDateTime } from "../../utils"
import ParamTag from "./ParamTag"
import RunRuntime from "./RunTime"
import StatusBadge from "./StatusBadge"

interface RunMetadataProps {
  run: RunPublic
}

function Parameters({ params }: { params: Record<string, any> }) {
  return (
    <Flex wrap={"wrap"}>
      {Object.keys(params)
        .filter((key) => params[key] !== null)
        .map((key) => (
          <Flex key={key} mr={1} my={1}>
            <ParamTag param={key} value={params[key]} />
          </Flex>
        ))}
    </Flex>
  )
}

function RunMetadata({ run }: RunMetadataProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const handleCopyRunUrl = () => {
    toast({
      description: "Run URL copied to clipboard!",
      status: "success",
      duration: 3000,
      isClosable: true,
      position: "bottom-right",
    })
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 3000)
  }

  const items = [
    {
      icon: HiOutlineStatusOnline,
      title: "Status",
      value: StatusBadge({ status: run.status }),
    },
    {
      icon: HiOutlineLightningBolt,
      title: "Tool",
      value: (
        <Link
          onClick={(e) => {
            e.stopPropagation()
            navigate({
              to: `/tools/${run.tool.name}`,
              replace: false,
              resetScroll: true,
            })
          }}
        >
          {run.tool.name}
        </Link>
      ),
    },
    {
      icon: HiOutlineTag,
      title: "Parameters",
      value: Parameters({ params: run.params }),
    },
    {
      icon: HiCalendarDays,
      title: "Started",
      value: humanReadableDateTime(run.started_at ? run.started_at : ""),
    },
    {
      icon: HiOutlineClock,
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

  if (run.shared) {
    items.push({
      icon: FiShare2,
      title: "Shared",
      value: (
        <Flex align="center">
          <Badge colorScheme="green">Anyone</Badge>
          <CopyToClipboard
            text={window.location.href}
            onCopy={handleCopyRunUrl}
          >
            <IconButton
              icon={
                copied ? (
                  <IoIosCheckmarkCircleOutline color="green" />
                ) : (
                  <IoIosCopy color="grey" />
                )
              }
              aria-label="Copy run URL to clipboard"
              size="xs"
              variant="ghost"
              colorScheme={copied ? "green" : "gray"}
            />
          </CopyToClipboard>
        </Flex>
      ),
    })
  }

  // Show owner name if this is a shared run viewed by someone else
  if (run.shared && run.owner_name) {
    items.push({
      icon: HiOutlineUser,
      title: "Owner",
      value: <Text>{run.owner_name}</Text>,
    })
  }

  if (run.tags && run.tags.length > 0) {
    items.push({
      icon: HiHashtag,
      title: "Tags",
      value: (
        <>
          {run.tags?.map((tag) => (
            <Badge key={tag} colorScheme="cyan" mr={1}>
              {tag}
            </Badge>
          ))}
        </>
      ),
    })
  }
  return (
    <Flex direction={"column"}>
      {items.map(({ icon, title, value }) => (
        <HStack key={title} align={"top"} mb={3}>
          <Flex w={32} shrink={0} direction={"column"}>
            <Flex align={"center"}>
              <Icon as={icon} />
              <Text ml={2}>{title}</Text>
            </Flex>
          </Flex>
          <Flex align={"center"}>{value}</Flex>
        </HStack>
      ))}
    </Flex>
  )
}

export default RunMetadata
