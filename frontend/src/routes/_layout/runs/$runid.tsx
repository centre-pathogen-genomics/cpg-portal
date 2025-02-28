import { ChevronRightIcon } from "@chakra-ui/icons"
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  ButtonGroup,
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
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { FilePublic } from "../../../client"
import OutputAccordion from "../../../components/Runs/OutputAccordion"
import RunMetadata from "../../../components/Runs/RunMetadata"
import OutputFile from "../../../components/Runs/OutputFile"
import CsvFileToTable from "../../../components/Render/CsvFileToTable"
import JsonFile from "../../../components/Render/JsonFile"
import TextFile from "../../../components/Render/TextFile"
import { readRunOptions } from "../../../client/@tanstack/react-query.gen"
import CancelRunButton from "../../../components/Runs/CancelRunButton"
import DeleteRunButton from "../../../components/Runs/DeleteRunButton"
import AISummaryButton from "../../../components/AI/AISummary"
import ReactMarkdown from "../../../components/Common/Markdown"



export const Route = createFileRoute("/_layout/runs/$runid")({
  component: Run,
})

function renderResult(file: FilePublic) {
  if (file.size && file.size < 500000) {
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

  const [llmSummary, setLlmSummary] = useState<string | null>(run.llm_summary || null);

  const fileTabs = run.files?.filter((file) => file.size && file.size < 500000) || [];

  const command = []
  if (run?.command) {
    command.push(run.command)
  }

  return (
    <Box maxW={"5xl"} justifySelf={"center"} w={"full"} overflowX={"hidden"}>
      <Flex direction="row" justify="space-between" align="center" mb={2} pb={2} pt={6} borderBottomWidth={1} >
        <Heading
          size="2xl"
          textAlign={{ base: "left"}}
          overflowX={"hidden"}
          pb={{ base: 0, md: 2}}
        >
          <Breadcrumb
            separator={<ChevronRightIcon color="gray.500" boxSize={10}/>}
          >
            <BreadcrumbItem>
              <BreadcrumbLink display={{ base: "none", sm: "block" }} whiteSpace={"nowrap"}
              onClick={
                () => navigate({
                  to: "/runs",
                  replace: false,
                  resetScroll: true,
                })
              }>My Runs</BreadcrumbLink>
              <BreadcrumbLink  display={{ base: "block", sm: "none" }}
              onClick={
                () => navigate({
                  to: "/runs",
                  replace: false,
                  resetScroll: true,
                })
              }>Runs</BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbItem isCurrentPage>
              <BreadcrumbLink whiteSpace={"nowrap"} >{run.name ?? run.id.split('-')[0]}</BreadcrumbLink>
            </BreadcrumbItem>
          </Breadcrumb>
        </Heading>
        <ButtonGroup
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
            }}
            ml={2}
          >
            {["running", "pending"].includes(run.status) ? (
              <CancelRunButton run_id={run.id} />
            ) : (
              <DeleteRunButton run_id={run.id} onDelete={() => navigate({to: "/runs"})} />
            )}
          </ButtonGroup>
      </Flex>
      <Box my={4} >
        <RunMetadata run={run} />
      </Box>
      {run.files.length > 0 && (
        <>
          <Heading size="md" mb={4}>
            Files
          </Heading>
          <Flex wrap="nowrap" overflowX={"auto"} mb={4}>
            {run.files.map((file) => (
              <Flex key={file.id} mb={2} mr={2} >
               <OutputFile file={file}/>
              </Flex>
            ))}
          </Flex>
          {run.files?.filter((file) => file.size && file.size < 500000).length > 0 && (
            <>
              <Flex direction="row" justify="space-between" align="center" justifyItems={'center'} alignItems={'center'}  mb={4}>
                <Heading size="md" >
                Results 
                </Heading>
                {run.tool.llm_summary_enabled && !llmSummary && (
                  <AISummaryButton
                    runId={run.id}
                    onGenerated={(summary) => {
                      setLlmSummary(summary);
                    }}
                  />
                )}
              </Flex>
              <Tabs variant="enclosed" overflowY={'auto'} >
                <TabList >
                  {run.tool.llm_summary_enabled && llmSummary && (
                    <Tab key="llm_summary">AI Summary</Tab>
                  )}
                  {fileTabs.map((file, index) => (
                    <Tab tabIndex={index} key={file.id}>{file.name.toLocaleUpperCase()}</Tab>
                  ))}
                </TabList>
                <TabPanels>
                  {run.tool.llm_summary_enabled && llmSummary && (
                    <TabPanel>
                      <Text fontWeight="bold" mb={2} fontSize={'sm'} color={'ui.danger'}>Large Language Models (AI) are prone to hallucinations and mistakes. Please use with caution.</Text>
                      <ReactMarkdown  markdown={llmSummary} />
                    </TabPanel>
                  )}
                  {fileTabs.map((file) => (
                    <TabPanel key={file.id}>
                      {renderResult(file)}
                    </TabPanel>
                  ))}
                </TabPanels>
              </Tabs>
            </>
          )}
        </>
      )}
      <OutputAccordion run={run} /> 
    </Box>
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
