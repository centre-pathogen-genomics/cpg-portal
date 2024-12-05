import { ViewIcon } from "@chakra-ui/icons"
import {
  Badge,
  Button,
  ButtonGroup,
  Container,
  Flex,
  Heading,
  Link,
  Skeleton,
  SkeletonText,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
} from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { TasksService } from "../../../client" // Import updated service
import CancelTaskButton from "../../../components/Tasks/CancelTaskButton"
import CancelTasksButton from "../../../components/Tasks/CancelTasksButton"
import DeleteTaskButton from "../../../components/Tasks/DeleteTaskButton"
import DeleteTasksButton from "../../../components/Tasks/DeleteTasksButton"
import TaskRuntime from "../../../components/Tasks/RunTime"
import StatusIcon from "../../../components/Tasks/StatusIcon"
import { PaginationFooter } from "../../../components/Common/PaginationFooter"
import { z } from "zod"

const tasksSearchSchema = z.object({
  page: z.number().catch(1),
})

export const Route = createFileRoute("/_layout/tasks/")({
  component: Tasks,
  validateSearch: (search) => tasksSearchSchema.parse(search),
})

const PER_PAGE = 8

function getTasksQueryOptions({ page }: { page: number }) {
  return {
    queryFn: () =>
      TasksService.readTasks({ skip: (page - 1) * PER_PAGE, limit: PER_PAGE }),
    queryKey: ["tasks", { page }],
  }
}

// Custom hook to poll tasks
function usePollTasks({ page }: { page: number }) {
  const fetchTasks = async () => {
    const response = await TasksService.readTasks({
      skip: (page - 1) * PER_PAGE,
      limit: PER_PAGE,
    })
    return response // Ensure we're returning paginated data
  }

  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: ["tasks", { page }],
    queryFn: fetchTasks,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  })

  return { data, isPending, isPlaceholderData }
}

function TasksTable() {
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const setPage = (page: number) =>
    navigate({ search: (prev: { page: number }) => ({ ...prev, page }) })

  const queryClient = useQueryClient()

  // Use usePollTasks with pagination
  const { data: tasks, isPending, isPlaceholderData } = usePollTasks({ page })

  const hasNextPage = !isPlaceholderData && tasks?.data.length === PER_PAGE
  const hasPreviousPage = page > 1

  useEffect(() => {
    if (hasNextPage) {
      queryClient.prefetchQuery(getTasksQueryOptions({ page: page + 1 }))
    }
  }, [page, queryClient, hasNextPage])

  return (
    <>
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
        <Thead>
          <Tr>
            <Th width="20%">ID</Th>
            <Th>Workflow</Th>
            <Th>Status</Th>
            <Th>Runtime</Th>
            <Th width="10%">Actions</Th>
          </Tr>
        </Thead>
        {isPending ? (
          <Tbody>
          <Tr>
            {new Array(5).fill(null).map((_, index) => (
              <Td key={index}>
                <SkeletonText noOfLines={1} paddingBlock="16px" />
              </Td>
            ))}
          </Tr>
        </Tbody>
        ) : (
            <Tbody>
              {tasks?.data.map((task) => (
                <Tr cursor="pointer" key={task.taskiq_id} onClick={() =>
                    navigate({
                      to: `/tasks/${task.id.toString()}`,
                      params: { taskid: task.id.toString() },
                      replace: false,
                      resetScroll: true,
                    })
                  }>
                  <Td>
                    <Tooltip
                      placement="top"
                      hasArrow
                      label={task.id}
                      bg="gray.300"
                      color="black"
                    >
                      <Badge variant="outline" colorScheme="green">
                        {task.id.split("-")[0]}
                      </Badge>
                    </Tooltip>
                  </Td>
                  <Td>
                    <Link
                      onClick={(e) =>{
                          e.stopPropagation();
                          navigate({
                            to: `/workflows/${task.workflow.name}`,
                            replace: false,
                            resetScroll: true,
                          })
                        }
                      }
                    >
                      {task.workflow.name}
                    </Link>
                  </Td>
                  <Td>
                    <StatusIcon status={task.status} />
                  </Td>
                  <Td>
                    <TaskRuntime
                      started_at={task.started_at}
                      finished_at={task.finished_at}
                      status={task.status}
                    />
                  </Td>
                  <Td >
                    <ButtonGroup onClick={(e) =>{
                          e.stopPropagation();
                        }
                      } size="sm" >
                      <Button
                        color="ui.main"
                        variant="solid"
                        leftIcon={<ViewIcon />}
                        onClick={() =>
                          navigate({
                            to: `/tasks/${task.id.toString()}`,
                            params: { taskid: task.id.toString() },
                            replace: false,
                            resetScroll: true,
                          })
                        }
                      >
                        View
                      </Button>
                      {["running", "pending"].includes(task.status) ? (
                        <CancelTaskButton task_id={task.id} />
                      ) : (
                        <DeleteTaskButton task_id={task.id} />
                      )}
                    </ButtonGroup>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          )}
      </Table>
    </TableContainer>
    <Flex justify="end" my={4}>
        <PaginationFooter
          onChangePage={setPage}
          page={page}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
        />
    </Flex>
    </>
  )
}


function Actions() {

  return (
    <Flex gap={4} mb={4} justify={"end"}>
      <CancelTasksButton/>
      <DeleteTasksButton/>
    </Flex>
  )
}


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
      <Actions />
      <TasksTable />
    </Container>
  )
}
