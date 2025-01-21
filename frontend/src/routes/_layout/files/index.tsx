import { useEffect} from "react"
import {
  Select,
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
  Tr,
  Text,
} from '@chakra-ui/react'
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import FileUpload from "../../../components/Files/UploadFileWithProgress"
import DeleteFileButton from "../../../components/Files/DeleteFileButton"
import DeleteFilesButton from "../../../components/Files/DeleteFilesButton"
import DownloadFileButton from "../../../components/Files/DownloadFileButton"
import { PaginationFooter } from "../../../components/Common/PaginationFooter"
import { FilesService } from "../../../client"
import { humanReadableDate, humanReadableFileSize } from "../../../utils"

// Define pagination schema
const filesSearchSchema = z.object({
  page: z.number().catch(1),
  pageSize: z.number().catch(8),
})

export const Route = createFileRoute("/_layout/files/")({
  component: Files,
  validateSearch: (search) => filesSearchSchema.parse(search),
})

// Function to get query options
function getFilesQueryOptions({ page, pageSize }: { page: number, pageSize: number }) {
  return {
    queryFn: async () =>
      (await FilesService.readFiles({ query: { skip: (page - 1) * pageSize, limit: pageSize } })).data,
    queryKey: ["files", { page, pageSize }],
  }
}

// Custom hook to fetch and poll files
function usePollFiles({ page, pageSize }: { page: number, pageSize: number }) {
  const fetchFiles = async () => {
    const response = await FilesService.readFiles({
      query: { skip: (page - 1) * pageSize, limit: pageSize },
    })
    return response.data
  }

  const { data, isPending, isPlaceholderData, refetch } = useQuery({
    queryKey: ["files", { page, pageSize }],
    queryFn: fetchFiles,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    placeholderData: (prev) => prev,
  })

  return { data, isPending, isPlaceholderData, refetch }
}

function FilesTable() {
  const { page, pageSize } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()

  const setPage = (page: number) =>
    navigate({ search: (prev: { page: number }) => ({ ...prev, page }) })

  const setPageSize = (newPageSize: number) =>
    navigate({ search: (prev: { page: number }) => ({ ...prev, page: 1, pageSize: newPageSize }) })

  const { data: files, isPending, isPlaceholderData } = usePollFiles({ page, pageSize })

  const hasNextPage = !isPlaceholderData && files?.data.length === pageSize
  const hasPreviousPage = page > 1

  useEffect(() => {
    if (hasNextPage) {
      queryClient.prefetchQuery(getFilesQueryOptions({ page: page + 1, pageSize }))
    }
  }, [page, pageSize, queryClient, hasNextPage])

  return (
    <>
      <TableContainer>
        <Table size={'sm'}>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Size</Th>
              <Th>Created</Th>
              <Th width="10%">Actions</Th>
            </Tr>
          </Thead>
          {isPending ? (
            <Tbody>
              {new Array(5).fill(null).map((_, index) => (
                <Tr key={index}>
                  {new Array(3).fill(null).map((_, index) => (
                    <Td key={index}>
                      <SkeletonText noOfLines={1} paddingBlock="16px" />
                    </Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          ) : (
            <Tbody>
              {files?.data.map((file) => (
                <Tr key={file.id}>
                  <Td>{file.name}</Td>
                  <Td>{file.file_type}</Td>
                  <Td>{file.size ? humanReadableFileSize(file.size) : ""}</Td>
                  <Td>{humanReadableDate(file.created_at)}</Td>
                  <Td>
                    <ButtonGroup size="sm">
                      <DownloadFileButton size="sm" fileId={file.id} />
                      <DeleteFileButton file={file} />
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
            <option value={8}>8</option>
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

function Files() {
  return (
    <Container maxW="full">
      <Stack spacing={1} my={2}>
        <Heading size="lg" pt={6}>
          My Files
        </Heading>
        <Text>From here you can upload, download, and delete files associated with your account.</Text>
      </Stack>
      <FileUpload />
      <Flex justify="space-between" align={"center"}>
        <Stack spacing={1} my={4}>
          <Heading size="md">Saved files</Heading>
          <Text>Files that are associated with your account.</Text>
        </Stack>
        <DeleteFilesButton />
      </Flex>
      <FilesTable />
    </Container>
  )
}
