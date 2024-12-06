import { ViewIcon } from "@chakra-ui/icons"
import {
  Badge,
  Button,
  ButtonGroup,
  Container,
  Flex,
  Heading,
  Link,
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
import { RunsService } from "../../../client" // Import updated service
import CancelRunButton from "../../../components/Runs/CancelRunButton"
import CancelRunsButton from "../../../components/Runs/CancelRunsButton"
import DeleteRunButton from "../../../components/Runs/DeleteRunButton"
import DeleteRunsButton from "../../../components/Runs/DeleteRunsButton"
import RunRuntime from "../../../components/Runs/RunTime"
import StatusIcon from "../../../components/Runs/StatusIcon"
import { PaginationFooter } from "../../../components/Common/PaginationFooter"
import { z } from "zod"

const runsSearchSchema = z.object({
  page: z.number().catch(1),
})

export const Route = createFileRoute("/_layout/runs/")({
  component: Runs,
  validateSearch: (search) => runsSearchSchema.parse(search),
})

const PER_PAGE = 8

function getRunsQueryOptions({ page }: { page: number }) {
  return {
    queryFn: () =>
      RunsService.readRuns({ skip: (page - 1) * PER_PAGE, limit: PER_PAGE }),
    queryKey: ["runs", { page }],
  }
}

// Custom hook to poll runs
function usePollRuns({ page }: { page: number }) {
  const fetchRuns = async () => {
    const response = await RunsService.readRuns({
      skip: (page - 1) * PER_PAGE,
      limit: PER_PAGE,
    })
    return response // Ensure we're returning paginated data
  }

  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: ["runs", { page }],
    queryFn: fetchRuns,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  })

  return { data, isPending, isPlaceholderData }
}

function RunsTable() {
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const setPage = (page: number) =>
    navigate({ search: (prev: { page: number }) => ({ ...prev, page }) })

  const queryClient = useQueryClient()

  // Use usePollRuns with pagination
  const { data: runs, isPending, isPlaceholderData } = usePollRuns({ page })

  const hasNextPage = !isPlaceholderData && runs?.data.length === PER_PAGE
  const hasPreviousPage = page > 1

  useEffect(() => {
    if (hasNextPage) {
      queryClient.prefetchQuery(getRunsQueryOptions({ page: page + 1 }))
    }
  }, [page, queryClient, hasNextPage])

  return (
    <>
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
        <Thead>
          <Tr>
            <Th width="20%">ID</Th>
            <Th>Tool</Th>
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
              {runs?.data.map((run) => (
                <Tr cursor="pointer" key={run.id} onClick={() =>
                    navigate({
                      to: `/runs/${run.id.toString()}`,
                      params: { runid: run.id.toString() },
                      replace: false,
                      resetScroll: true,
                    })
                  }>
                  <Td>
                    <Tooltip
                      placement="top"
                      hasArrow
                      label={run.id}
                      bg="gray.300"
                      color="black"
                    >
                      <Badge variant="outline" colorScheme="green">
                        {run.id.split("-")[0]}
                      </Badge>
                    </Tooltip>
                  </Td>
                  <Td>
                    <Link
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
                  </Td>
                  <Td>
                    <StatusIcon status={run.status} />
                  </Td>
                  <Td>
                    <RunRuntime
                      started_at={run.started_at}
                      finished_at={run.finished_at}
                      status={run.status}
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
                            to: `/runs/${run.id.toString()}`,
                            params: { runid: run.id.toString() },
                            replace: false,
                            resetScroll: true,
                          })
                        }
                      >
                        View
                      </Button>
                      {["running", "pending"].includes(run.status) ? (
                        <CancelRunButton run_id={run.id} />
                      ) : (
                        <DeleteRunButton run_id={run.id} />
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
      <CancelRunsButton/>
      <DeleteRunsButton/>
    </Flex>
  )
}


function Runs() {
  return (
    <Container maxW="full">
      <Heading
        size="lg"
        textAlign={{ base: "center", md: "left" }}
        pt={12}
        pb={8}
      >
        Runs
      </Heading>
      {/* <RunStats /> */}
      <Actions />
      <RunsTable />
    </Container>
  )
}
