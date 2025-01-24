import { ChevronRightIcon } from "@chakra-ui/icons"
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Container,
  Flex,
  Heading,
  HStack,
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
import OutputAccordion from "../../../components/Runs/OutputAccordion"
import RunMetadata from "../../../components/Runs/RunMetadata"
import Command from "../../../components/Runs/Command"
import OutputFile from "../../../components/Runs/OutputFile"
import CsvFileToTable from "../../../components/Render/CsvFileToTable"
import JsonFile from "../../../components/Render/JsonFile"
import TextFile from "../../../components/Render/TextFile"
import DownloadFileButton from "../../../components/Files/DownloadFileButton"
import SaveFileButton from "../../../components/Files/SaveFileButton"
import { readRunOptions } from "../../../client/@tanstack/react-query.gen"
import { humanReadableFileSize } from "../../../utils"

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
      <Box mb={4} >
        <RunMetadata run={run} />
        {run.command && (<Command command={run.command}/>)}
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
              <Heading size="md" mb={4}>
                Outputs
              </Heading> 
              <Tabs  variant="enclosed" >
                <TabList>
                {run.files?.filter((file) => file.size && file.size < 500000).map((file) => (
                  <Tab key={file.id}>{file.name.toLocaleUpperCase()}</Tab>
                ))} 
                </TabList>
                <TabPanels>
                {run.files?.map((file) => (
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
