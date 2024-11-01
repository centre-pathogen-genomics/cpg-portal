import { ChevronRightIcon } from "@chakra-ui/icons"
import {
  Badge,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Card,
  CardBody,
  Center,
  Code,
  Container,
  Heading,
  SimpleGrid,
  Skeleton,
  Text,
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { FiFileText } from "react-icons/fi"
import { TasksService } from "../../../client"
import TaskRuntime from "../../../components/Tasks/RunTime"

export const Route = createFileRoute("/_layout/tasks/$taskid")({
  component: Task,
})

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
        : false // Poll every 5 seconds
    },
    refetchIntervalInBackground: true,
  })

  const handleDownload = (fileId: string) => {
    const downloadUrl = `${import.meta.env.VITE_API_URL}/api/v1/files/${fileId}/download`
    window.open(downloadUrl, "_blank")
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
            <BreadcrumbLink href="/tasks">Analyses</BreadcrumbLink>
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
          <Badge borderRadius="full" px="2" colorScheme="teal">
            {task.status}
          </Badge>
        </Text>
        <Text>
          Runtime: <TaskRuntime task={task} />
        </Text>
        <Text>Started: {task.started_at}</Text>
        <Text>Completed: {task.finished_at}</Text>
      </Box>
      {task.result?.files && (
        <Heading mb={2} size="lg">
          Files: {task.result.files.length}
        </Heading>
      )}
      <SimpleGrid
        pb={4}
        spacing={4}
        templateColumns="repeat(auto-fill, minmax(400px, 1fr))"
      >
        {task.result?.files?.map((file) => (
          <Card p={4} key={file.id} direction="row" borderWidth={3}>
            <Center>
              <FiFileText strokeWidth={1} size={60} />
            </Center>
            <CardBody p={0} pl={2}>
              <Box
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                <Heading size="md" pb={1}>
                  {file.name}
                </Heading>
              </Box>
              <Button size="sm" mt={2} onClick={() => handleDownload(file.id)}>
                Download
              </Button>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>
      {task.result?.results && (
        <>
          <Heading mb={2} size="lg">
            Output
          </Heading>
          <Card>
            <CardBody>
              <Text>{JSON.stringify(task.result.results, null, 2)}</Text>
            </CardBody>
          </Card>
        </>
      )}
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
