import {
  Badge,
  Button,
  ButtonGroup,
  Container,
  Flex,
  Heading,
  SkeletonText,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
  useColorModeValue,
  Text,
} from "@chakra-ui/react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { RunsService } from "../../../client"
import CancelRunButton from "../../../components/Runs/CancelRunButton"
import CancelRunsButton from "../../../components/Runs/CancelRunsButton"
import DeleteRunButton from "../../../components/Runs/DeleteRunButton"
import DeleteRunsButton from "../../../components/Runs/DeleteRunsButton"
import RunRuntime from "../../../components/Runs/RunTime"
import StatusIcon from "../../../components/Runs/StatusIcon"
import ParamTag from "../../../components/Runs/ParamTag"
import { humanReadableDate } from "../../../utils"

export const Route = createFileRoute("/_layout/runs/")({
  component: Runs,
})

function RunsTable() {
  const pageSize = 20
  const navigate = useNavigate({ from: Route.fullPath })
  const colourMode = useColorModeValue("gray.50", "gray.700")
  const queryClient = useQueryClient()

  // Remove the runs query when component unmounts so that only the first page is fetched next time.
  useEffect(() => {
    return () => {
      queryClient.removeQueries({ queryKey: ["runs", pageSize] })
    }
  }, [queryClient, pageSize])

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["runs", pageSize],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await RunsService.readRuns({
        query: { skip: (pageParam - 1) * pageSize, limit: pageSize },
        timeout: 10000,
      })
      return response.data
    },
    // Set the initial page parameter explicitly.
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage?.data.length === pageSize) {
        return pages.length + 1 // next page number
      }
      return undefined
    },
    refetchInterval: 5000,
  })

  // Flatten the pages into one list of runs.
  const runs = data?.pages.filter(run => run !== undefined).flatMap((page) => page?.data) || []

  return (
    <>
      <TableContainer>
        <Table size={{ base: "sm" }}>
          <Thead>
            <Tr>
              <Th width="10%">ID</Th>
              <Th>Tool</Th>
              <Th>Tags</Th>
              <Th>Params</Th>
              <Th>Status</Th>
              <Th>Date</Th>
              <Th>Runtime</Th>
              <Th width="10%">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              // Show skeletons while loading the first page.
              <Tr>
                {new Array(5).fill(null).map((_, index) => (
                  <Td key={index}>
                    <SkeletonText noOfLines={1} paddingBlock="16px" />
                  </Td>
                ))}
              </Tr>
            ) : isError ? (
              // Display error message if something went wrong.
              <Tr>
                <Td colSpan={8}>
                  <Text color="red.500">Error: {(error as Error).message}</Text>
                </Td>
              </Tr>
            ) : (
              // Render the loaded runs.
              runs.map((run) => (
                <Tr
                  key={run.id}
                  _hover={{ bg: colourMode }}
                  cursor="pointer"
                  onClick={() =>
                    navigate({
                      to: `/runs/${run.id.toString()}`,
                      params: { runid: run.id.toString() },
                      replace: false,
                      resetScroll: true,
                    })
                  }
                >
                  <Td>
                    <Tooltip placement="top" hasArrow label={run.id}>
                      <Badge variant="outline" colorScheme="green">
                        {run.id.split("-")[0]}
                      </Badge>
                    </Tooltip>
                  </Td>
                  <Td>{run.tool.name}</Td>
                  <Td>
                    {run.tags?.map((tag) => (
                      <Badge key={tag} colorScheme="cyan" mr={1}>
                        {tag}
                      </Badge>
                    ))}
                  </Td>
                  <Td textAlign="center">
                    <Flex wrap={"wrap"} justify="start">
                      {Object.keys(run.params)
                        .filter((key) => run.params[key] !== null)
                        .map((key) => (
                          <Flex key={key} m={0.5}>
                            <ParamTag param={key} value={run.params[key]} />
                          </Flex>
                        ))}
                    </Flex>
                  </Td>
                  <Td>
                    <StatusIcon status={run.status} />
                  </Td>
                  <Td>{run.started_at ? humanReadableDate(run.started_at) : ""}</Td>
                  <Td>
                    <RunRuntime
                      started_at={run.started_at ?? null}
                      finished_at={run.finished_at ?? null}
                      status={run.status}
                    />
                  </Td>
                  <Td textAlign="center">
                    <ButtonGroup
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      {["running", "pending"].includes(run.status) ? (
                        <CancelRunButton run_id={run.id} />
                      ) : (
                        <DeleteRunButton run_id={run.id} />
                      )}
                    </ButtonGroup>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </TableContainer>

      {/* Load More Button */}
      {hasNextPage && (
        <Flex justify="center" py={4}>
          <Button onClick={() => fetchNextPage()} isLoading={isFetchingNextPage}>
            Load more runs
          </Button>
        </Flex>
      )}
    </>
  )
}

function Actions() {
  return (
    <Flex gap={4} mb={4} justify={"end"}>
      <CancelRunsButton />
      <DeleteRunsButton />
    </Flex>
  )
}

// The Runs component now wraps the table in a scrollable container.
// The header (heading and descriptive text) and actions remain fixed at the top.
function Runs() {
  return (
    <Container maxW={"full"}>
      <Stack spacing={1} mb={2}>
        <Heading size="2xl" pt={6}>
          My Runs
        </Heading>
        <Text>Click on a run to view more details and results.</Text>
      </Stack>
      <Actions />
      <RunsTable />
    </Container>
  )
}

export default Runs
