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
  Code,
  Container,
  Flex,
  Heading,
  Skeleton,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { ResultPublicWithFileAndTarget, RunsService } from "../../../client"
import RunRuntime from "../../../components/Runs/RunTime"
import CsvFileToTable from "../../../components/Render/CsvFileToTable"
import JsonFile from "../../../components/Render/JsonFile"
import CodeBlock from "../../../components/Common/CodeBlock"
import DownloadFileButton from "../../../components/Files/DownloadFileButton"

export const Route = createFileRoute("/_layout/runs/$runid")({
  component: Run,
})

function renderResult(result: ResultPublicWithFileAndTarget) {
  if (result.target.display) {
    switch (result.target.target_type) {
      case "csv":
      case "tsv":
        return <CsvFileToTable fileId={result.file.id} />
      case "json":
        return <JsonFile fileId={result.file.id} />
      default:
        return <DownloadFileButton fileId={result.file.id} />
    }
  }
  return null
}

function RunDetail() {
  const { runid } = Route.useParams()

  // Using useSuspenseQuery for data fetching

  const { data: run } = useSuspenseQuery({
    queryKey: ["run", { id: runid }],
    queryFn: () => RunsService.readRun({ id: runid }),
    refetchInterval: (run) => {
      return (run && run.state.data?.status === "running") ||
        run.state.data?.status === "pending"
        ? 3000
        : false // Poll every 3 seconds if run is running or pending
    },
    refetchIntervalInBackground: true,
  })

  const command = []
  if (run?.tool?.setup_command) {
    command.push(run.tool.setup_command)
  } 
  if (run?.command) {
    command.push(run.command)
  }

  return (
    <>
      <Heading
        size="lg"
        textAlign={{ base: "center", md: "left" }}
        pt={12}
        pb={8}
      >
        <Breadcrumb
          spacing="2px"
          separator={<ChevronRightIcon color="gray.500" />}
        >
          <BreadcrumbItem>
            <BreadcrumbLink href="/runs">Runs</BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink href="#">{run.id}</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>
      </Heading>
      <Box mb={4}>
        <Text>
          Tool: <Code>{run.tool.name}</Code>
        </Text>
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
      {run.results.length > 0 && (
        <Tabs  variant="enclosed" >
          <TabList mb='1em'>
          {run.results?.map((result) => (
            <>
              {result.target.display && (
                <Tab key={result.id}>{result.file.name}</Tab>
              )}
            </>
          ))} 
          </TabList>
          <TabPanels>
          {run.results?.map((result) => (
            <>
              {result.target.display && (
                <TabPanel>
                  {renderResult(result)} 
                </TabPanel>
              )}
            </>
          ))}
          </TabPanels>
        </Tabs>
      )}
      <Accordion allowToggle allowMultiple mb={4}>
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
    </>
  )
}

function Run() {
  return (
    <Container maxW="full">
      <Suspense fallback={<Skeleton height="20px" />}>
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
