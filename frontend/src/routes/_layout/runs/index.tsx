import {
  Badge,
  Box,
  ButtonGroup,
  Container,
  Flex,
  Heading,
  Link,
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
  Select,
} from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
import { PaginationFooter } from "../../../components/Common/PaginationFooter"
import { z } from "zod"
import { humanReadableDate } from "../../../utils"

// Define the search schema to include pageSize
const runsSearchSchema = z.object({
  page: z.number().catch(1),
  pageSize: z.number().catch(10),
})

export const Route = createFileRoute("/_layout/runs/")({
  component: Runs,
  validateSearch: (search) => runsSearchSchema.parse(search),
})

// Function to fetch runs with pagination
function getRunsQueryOptions({ page, pageSize }: { page: number, pageSize: number }) {
  return {
    queryFn: async () =>
      (await RunsService.readRuns({
        query: { skip: (page - 1) * pageSize, limit: pageSize },
      })).data,
    queryKey: ["runs", { page, pageSize }],
  }
}

// Custom hook to fetch and poll runs
function usePollRuns({ page, pageSize }: { page: number, pageSize: number }) {
  const fetchRuns = async () => {
    const response = await RunsService.readRuns({
      query: { skip: (page - 1) * pageSize, limit: pageSize },
    })
    return response.data
  }

  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: ["runs", { page, pageSize }],
    queryFn: fetchRuns,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  })

  return { data, isPending, isPlaceholderData }
}

function RunsTable() {
  const { page, pageSize } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const colourMode = useColorModeValue("gray.100", "gray.700")
  const setPage = (page: number) =>
    navigate({ search: (prev: { page: number }) => ({ ...prev, page }) });

  const setPageSize = (newPageSize: number) =>
    navigate({ search: (prev: { page: number }) => ({ ...prev, page: 1, pageSize: newPageSize }) });

  // Ensure this hook is called consistently
  const { data: runs, isPending, isPlaceholderData } = usePollRuns({ page, pageSize });

  const hasNextPage = !isPlaceholderData && runs?.data.length === pageSize;
  const hasPreviousPage = page > 1;

  // Prefetch the next page unconditionally
  useEffect(() => {
    if (hasNextPage) {
      queryClient.prefetchQuery(getRunsQueryOptions({ page: page + 1, pageSize }));
    }
  }, [page, pageSize, queryClient, hasNextPage]);


  return (
    <>
      <TableContainer>
        <Table size={{ base: "sm" }}>
          <Thead>
            <Tr>
              <Th width="10%">ID</Th>
              <Th>Tool</Th>
              <Th>Params</Th>
              <Th>Status</Th>
              <Th>Date</Th>
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
                <Tr
                  _hover={{ bg: colourMode }}
                  cursor="pointer"
                  key={run.id}
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
                  <Td>
                    <Link
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate({
                          to: `/tools/${run.tool.name}`,
                          replace: false,
                          resetScroll: true,
                        })
                      }}
                    >
                      {run.tool.name}
                    </Link>
                  </Td>
                  <Td>
                    {Object.keys(run.params).map((key) => (
                      <Box key={key} mr={2} mb={1}>
                        <ParamTag key={key} truncate param={key} value={(run.params[key] as string).toString()} />
                      </Box>
                    ))}
                  </Td>
                  <Td>
                    <StatusIcon status={run.status} />
                  </Td>
                  <Td>{run.started_at ? humanReadableDate(run.started_at) : ""}</Td>
                  <Td>
                    <RunRuntime
                      started_at={run.started_at}
                      finished_at={run.finished_at}
                      status={run.status}
                    />
                  </Td>
                  <Td justifyContent={"center"} align="center" textAlign={"center"}>
                    <ButtonGroup
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      size="sm"
                    >
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
      <Flex justify="space-between" my={4}>
        <Select
            width="auto"
            value={pageSize}
            onChange={(e) => setPageSize(parseInt(e.target.value))}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
        </Select>
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
      <CancelRunsButton />
      <DeleteRunsButton />
    </Flex>
  )
}

function Runs() {
  return (
    <Container maxW="full">
      <Stack spacing={1} my={2}>
        <Heading size="lg" pt={6}>
          My Runs
        </Heading>
        <Text>Click on a run to view more details and results.</Text>
      </Stack>
      <Actions />
      <RunsTable />
    </Container>
  )
}
