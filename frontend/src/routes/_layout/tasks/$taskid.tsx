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
import { ResultPublicWithFileAndTarget, TasksService } from "../../../client"
import TaskRuntime from "../../../components/Tasks/RunTime"
import CsvFileToTable from "../../../components/Render/CsvFileToTable"
import JsonFile from "../../../components/Render/JsonFile"
import CodeBlock from "../../../components/Common/CodeBlock"
import DownloadFileButton from "../../../components/Files/DownloadFileButton"

export const Route = createFileRoute("/_layout/tasks/$taskid")({
  component: Task,
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

function TaskDetail() {
  const { taskid } = Route.useParams()

  // Using useSuspenseQuery for data fetching

  const { data: task } = useSuspenseQuery({
    queryKey: ["task", { id: taskid }],
    queryFn: () => TasksService.readTask({ id: taskid }),
    refetchInterval: (task) => {
      return (task && task.state.data?.status === "running") ||
        task.state.data?.status === "pending"
        ? 3000
        : false // Poll every 3 seconds if task is running or pending
    },
    refetchIntervalInBackground: true,
  })

  const command = []
  if (task?.workflow?.setup_command) {
    command.push(task.workflow.setup_command)
  } 
  if (task?.command) {
    command.push(task.command)
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
            <BreadcrumbLink href="/tasks">Tasks</BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink href="#">{task.id}</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>
      </Heading>
      <Box mb={4}>
        <Text>
          Workflow: <Code>{task.workflow.name}</Code>
        </Text>
        <Text>
          Status:{" "}
          <Badge borderRadius="full" px="2" colorScheme={task.status == "failed" ? "red" :"teal"}>
            {task.status}
          </Badge>
        </Text>
        <Text>
          Runtime: <TaskRuntime started_at={task.started_at} finished_at={task.finished_at} status={task.status}  />
        </Text>
        <Text>Started: {task.started_at}</Text>
        <Text>Completed: {task.finished_at}</Text>
      </Box>
      {task.results.length > 0 && (
        <Tabs  variant="enclosed" >
          <TabList mb='1em'>
          {task.results?.map((result) => (
            <>
              {result.target.display && (
                <Tab key={result.id}>{result.file.name}</Tab>
              )}
            </>
          ))} 
          </TabList>
          <TabPanels>
          {task.results?.map((result) => (
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
          { task.command ? (
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
                  {(task.stdout?.length && task.stdout?.length > 0) ? task.stdout?.trim().split("\n").length : 0}
                </Badge>
                </Flex>
              </Box>
            <AccordionIcon />
            </AccordionButton>
          </h2>
          <AccordionPanel pb={4}>
          { task.stdout?.length && task.stdout?.length > 0 ? (
            <Text style={{ whiteSpace: "pre-wrap" }}>
              {task.stdout}
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
                {(task.stderr?.length && task.stderr?.length > 0) ? task.stderr?.trim().split("\n").length : 0}
                </Badge>
                </Flex>
              </Box>
              <AccordionIcon />
            </AccordionButton>
          </h2>
          <AccordionPanel pb={4}>
          { task.stderr?.length && task.stderr.length > 0 ? (
            <Text style={{ whiteSpace: "pre-wrap" }}>
              {task.stderr}
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

function Task() {
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
          <TaskDetail />
        </ErrorBoundary>
      </Suspense>
    </Container>
  )
}

export default Task
