import { Badge, Flex, HStack, Icon, Link, Text} from "@chakra-ui/react";
import { RunPublic, RunStatus } from "../../client";
import { HiOutlineStatusOnline } from "react-icons/hi";
import { HiOutlineLightningBolt } from "react-icons/hi";
import { HiOutlineTag } from "react-icons/hi";
import { HiCalendarDays } from "react-icons/hi2";
import { HiOutlineClock } from "react-icons/hi2";
import { SiAnaconda } from "react-icons/si";




import { useNavigate } from "@tanstack/react-router";
import ParamTag from "./ParamTag";
import { humanReadableDateTime } from "../../utils";
import RunRuntime from "./RunTime";


interface RunMetadataProps {
  run: RunPublic
}
function StatusBadge({ status }: { status: RunStatus}) {
    const colorScheme = {
        "running": "green",
        "failed": "red",
        "completed": "teal",
        "pending": "purple",
        "cancelled": "gray",
    } 
    return (
        <Badge variant='outline'  colorScheme={colorScheme[status] || "teal"}>
            {status}
          </Badge>
    )
}

function Parameters({ params }: { params: Record<string, any> }) {
    return (
        <Flex wrap={'wrap'}>
            {Object.keys(params).filter((key) => params[key] !== null).map((key) => (
                <Flex key={key} mr={1} my={1} >
                <ParamTag param={key} value={params[key]} />
                </Flex>
            ))}
        </Flex>
    )
}

function condaEnvDownloadLink({ env }: { env: string | null }) {
    if (!env) {
        return (
            <Text></Text>
        )
    }
    return (
        <Link href={`data:text/plain;charset=utf-8,${encodeURIComponent(env)}`} download="environment.yaml">
            environment.yaml
        </Link>
    )
}

function RunMetadata({ run }: RunMetadataProps) {
    const navigate = useNavigate()
    const items = [
        { icon: HiOutlineStatusOnline, title: "Status", value: StatusBadge({status: run.status}) },
        { icon: HiOutlineLightningBolt, title: "Tool", value: (<Link onClick={(e) =>{e.stopPropagation(); navigate({
                to: `/tools/${run.tool.name}`,
                replace: false,
                resetScroll: true,
                    })
                    }
                }
                >
                {run.tool.name}
            </Link>) },
        { icon: HiCalendarDays, title: "Started", value: humanReadableDateTime(run.started_at ? run.started_at : "") },
        { icon: HiOutlineClock, title: "Runtime", value: (<RunRuntime started_at={run.started_at ?? null} finished_at={run.finished_at ?? null} status={run.status} />) },
        { icon: SiAnaconda, title: "Conda", value: condaEnvDownloadLink({ env: run.conda_env_pinned ?? null }) },
        { icon: HiOutlineTag, title: "Parameters", value: Parameters({params: run.params}) },
    ]
  return (
    <Flex direction={'column'}>
            {items.map(({ icon, title, value }) => (
                <HStack key={title} align={'top'} mb={3}  >
                    <Flex w={32} shrink={0}  direction={'column'} >
                        <Flex  align={'center'} >
                            <Icon as={icon}  />
                            <Text ml={2}>{title}</Text>
                        </Flex>
                    </Flex>
                    <Flex align={'center'} >
                    {value}
                    </Flex>
                </HStack>
            ))}
    </Flex>
    
  );
}

export default RunMetadata;
