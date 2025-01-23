import { ChevronRightIcon } from "@chakra-ui/icons"
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Container,
  Flex,
  Heading,
  HStack,
  Link,
  Skeleton,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { FilePublic } from "../../../client"
import RunRuntime from "../../../components/Runs/RunTime"
import CsvFileToTable from "../../../components/Render/CsvFileToTable"
import JsonFile from "../../../components/Render/JsonFile"
import TextFile from "../../../components/Render/TextFile"
import CodeBlock from "../../../components/Common/CodeBlock"
import DownloadFileButton from "../../../components/Files/DownloadFileButton"
import SaveFileButton from "../../../components/Files/SaveFileButton"
import ParamTag from "../../../components/Runs/ParamTag"
import { readRunOptions } from "../../../client/@tanstack/react-query.gen"
import { humanReadableFileSize } from "../../../utils"

export const Route = createFileRoute("/_layout/runs/$runid")({
  component: Run,
})

function renderResult(file: FilePublic) {
  if (file.size && file.size < 5000) {
    switch (file.file_type) {
      case "csv":
      case "tsv":
        return <CsvFileToTable fileId={file.id} />
      case "json":
        return <JsonFile fileId={file.id} />
      case "text":
        return <TextFile fileId={file.id} />
      default:
        return null
    }
  }
}

function RunDetail() {
  const { runid } = Route.useParams()
  const navigate = useNavigate({ from: Route.fullPath })

  // Using useSuspenseQuery for data fetching

  const { data: run } = useSuspenseQuery({
    ...readRunOptions({path: {id: runid}}),
    refetchInterval: (run) => {
      return (run && run.state.data?.status === "running") ||
        run.state.data?.status === "pending"
        ? 3000
        : false // Poll every 3 seconds if run is running or pending
    },
    refetchIntervalInBackground: true,
  })

  const command = []
  if (run?.command) {
    command.push(run.command)
  }

  return (
    <>
      <Heading
        size="lg"
        textAlign={{ base: "left"}}
        pt={6}
        pb={8}
      >
        <Breadcrumb
          spacing="2px"
          separator={<ChevronRightIcon color="gray.500" />}
        >
          <BreadcrumbItem>
            <BreadcrumbLink onClick={
              () => navigate({
                to: "/runs",
                replace: false,
                resetScroll: true,
              })
            }>Runs</BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink >{run.id}</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>
      </Heading>
      <Box mb={4}>
        <Text>
          Tool: <Link
                      onClick={(e) =>{
                          e.stopPropagation();
                          navigate({
                            to: `/tools/${run.tool.name}`,
                            replace: false,
                            resetScroll: true,
                          })
                        }
                      }
                    >
                      {run.tool.name}
                </Link>
        </Text>
        <Flex wrap={'wrap'}>
        <Text>Parameters:</Text>
        {Object.keys(run.params).filter((key) => run.params[key] !== null).map((key) => (
                          <Flex key={key} m={1} my={1}>
                            <ParamTag param={key} value={run.params[key]} />
                          </Flex>
                      ))}
        </Flex>
        <Text>
          Status:{" "}
          <Badge borderRadius="full" px="2" colorScheme={run.status == "failed" ? "red" :"teal"}>
            {run.status}
          </Badge>
        </Text>
        <Text>
          Runtime: <RunRuntime started_at={run.started_at} finished_at={run.finished_at} status={run.status}  />
        </Text>
        <Text>Started: {run.started_at}</Text>
        <Text>Completed: {run.finished_at}</Text>
      </Box>
      <Accordion defaultIndex={[0]} allowMultiple mb={4}>
        <AccordionItem>
          <h2>
            <AccordionButton>
              <Box as='span' flex='1' textAlign='left'>
                Command
              </Box>
              <AccordionIcon />
            </AccordionButton>
          </h2>
          <AccordionPanel pb={4}>
          { run.command ? (
            <>
            <CodeBlock code={command.join("\n")} language="bash" />

            </>
          ) : (
            <Text>...</Text>
          )}
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem>
          <h2>
            <AccordionButton>
              <Box as='span' flex='1' textAlign='left'>
                <Flex alignItems="center">
                <Text>
                  Stdout 
                </Text>
                <Badge borderRadius="full" ml="2" px="2"colorScheme="teal">
                  {(run.stdout?.length && run.stdout?.length > 0) ? run.stdout?.trim().split("\n").length : 0}
                </Badge>
                </Flex>
              </Box>
            <AccordionIcon />
            </AccordionButton>
          </h2>
          <AccordionPanel pb={4}>
          { run.stdout?.length && run.stdout?.length > 0 ? (
            <Text style={{ whiteSpace: "pre-wrap" }}>
              {run.stdout}
            </Text>
          ) : (
            <Text>No output</Text>
           )}
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem>
          <h2>
            <AccordionButton>
            <Box as='span' flex='1' textAlign='left'>
                <Flex alignItems="center">
                <Text>
                  Stderr 
                </Text>
                <Badge borderRadius="full" ml="2" px="2"colorScheme="teal">
                {(run.stderr?.length && run.stderr?.length > 0) ? run.stderr?.trim().split("\n").length : 0}
                </Badge>
                </Flex>
              </Box>
              <AccordionIcon />
            </AccordionButton>
          </h2>
          <AccordionPanel pb={4}>
          { run.stderr?.length && run.stderr.length > 0 ? (
            <Text style={{ whiteSpace: "pre-wrap" }}>
              {run.stderr}
            </Text>
          ) : (
            <Text>No output</Text>
           )}
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
      {run.files.length > 0 && (
        <Tabs  variant="enclosed" >
          <TabList>
          {run.files?.map((file) => (
            <Tab key={file.id}>{file.name} ({file.size ? humanReadableFileSize(file.size): "Unknown size"})</Tab>
          ))} 
          </TabList>
          <TabPanels>
          {run.files?.map((file) => (
            <TabPanel key={file.id}>
              <HStack mb={4} justify={"space-between"}>
                <DownloadFileButton fileId={file.id} />
                <SaveFileButton fileId={file.id} saved={file.saved ? file.saved : false } />
              </HStack>
              {renderResult(file)}
            </TabPanel>
          ))}
          </TabPanels>
        </Tabs>
      )}
      
    </>
  )
}

function RunSkeleton() {
  return (
    <Container maxW="full">
      <Skeleton height="20px"/>
    </Container>
  )
}

function Run() {
  return (
    <Container maxW="full">
      <Suspense fallback={<RunSkeleton />}>
        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Box>
              <Text>Error: {error.message}</Text>
            </Box>
          )}
        >
          <RunDetail />
        </ErrorBoundary>
      </Suspense>
    </Container>
  )
}

export default Run
