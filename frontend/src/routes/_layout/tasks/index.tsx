import { ViewIcon } from "@chakra-ui/icons"
import {
  Button,
  ButtonGroup,
  Code,
  Container,
  Flex,
  Heading,
  Skeleton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { type TasksPublic, TasksService } from "../../../client" // Import updated service
import CancelTaskButton from "../../../components/Tasks/CancelTaskButton"
import DeleteTaskButton from "../../../components/Tasks/DeleteTaskButton"
import TaskRuntime from "../../../components/Tasks/RunTime"
import StatusIcon from "../../../components/Tasks/StatusIcon"

export const Route = createFileRoute("/_layout/tasks/")({
  component: Tasks,
})

// Custom hook to poll tasks with status "running"
// Custom hook to poll tasks
function usePollTasks() {
  const fetchTasks = async () => {
    const response = await TasksService.readTasks({})
    return response // Ensure we're returning the data array
  }

  // Use useSuspenseQuery for handling data fetching with suspense
  const { data, refetch, status } = useSuspenseQuery<TasksPublic, Error>({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  })

  return { data, refetch, status }
}

function TasksTableBody() {
  const { data } = usePollTasks()
  const tasks = data?.data || [] // Update tasks array
  const navigate = useNavigate()
  return (
    <Tbody>
      {tasks.map(
        (
          task, // Update task iteration
        ) => (
          <Tr key={task.taskiq_id}>
            <Td>{task.id}</Td>
            <Td>
              <StatusIcon status={task.status} />
            </Td>
            <Td>
              <TaskRuntime task={task} />
            </Td>
            <Td>
              <Code>{task.workflow.name}</Code>
            </Td>
            <Td>
              <ButtonGroup size="sm">
                {/* view button that routes to /tasks/{task.id} */}
                <Button
                  color="ui.main"
                  variant="solid"
                  leftIcon={<ViewIcon />}
                  onClick={() => {
                    navigate({
                      to: `/tasks/${task.id.toString()}`,
                      params: { taskid: task.id.toString() },
                      replace: false,
                      resetScroll: true,
                    })
                  }}
                >
                  View
                </Button>
                {["running", "pending"].includes(task.status) ? (
                  <CancelTaskButton task={task} />
                ) : (
                  <DeleteTaskButton task={task} />
                )}
              </ButtonGroup>
            </Td>
          </Tr>
        ),
      )}
    </Tbody>
  )
}

function TasksTable() {
  return (
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
        <Thead>
          <Tr>
            <Th>ID</Th>
            <Th>Status</Th>
            <Th>Runtime</Th>
            <Th>Workflow</Th>
            <Th>Actions</Th>
            <Th />
          </Tr>
        </Thead>
        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Tbody>
              <Tr>
                <Td colSpan={5}>Something went wrong: {error.message}</Td>
              </Tr>
            </Tbody>
          )}
        >
          <Suspense
            fallback={
              <Tbody>
                {new Array(5).fill(null).map((_, index) => (
                  <Tr key={index}>
                    {new Array(5).fill(null).map((_, index) => (
                      <Td key={index}>
                        <Flex>
                          <Skeleton height="20px" width="20px" />
                        </Flex>
                      </Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            }
          >
            <TasksTableBody />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

// function TaskStats() {
//   const { data } = usePollTasks()
//   const count = data?.count || [] // Update tasks array

//   return (
//     <StatGroup>
//       <Stat p="4" borderRadius="lg" borderWidth="1px">
//         <StatLabel>Total Tasks</StatLabel>
//         <StatNumber>{count}</StatNumber>
//       </Stat>
//     </StatGroup>
//   )
// }

function Tasks() {
  return (
    <Container maxW="full">
      <Heading
        size="lg"
        textAlign={{ base: "center", md: "left" }}
        pt={12}
        pb={8}
      >
        Tasks
      </Heading>
      {/* <TaskStats /> */}
      <TasksTable />
    </Container>
  )
}
