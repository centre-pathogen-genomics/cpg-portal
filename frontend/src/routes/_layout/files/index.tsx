import { useEffect } from "react"
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
  Tr,
  Text,
} from "@chakra-ui/react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import FileUpload from "../../../components/Files/UploadFileButtonWithProgress"
import DeleteFileButton from "../../../components/Files/DeleteFileButton"
import DeleteFilesButton from "../../../components/Files/DeleteFilesButton"
import DownloadFileButton from "../../../components/Files/DownloadFileButton"
import StorageStats from "../../../components/Files/StorageStats"
import { FilesService } from "../../../client"
import { humanReadableDate, humanReadableFileSize } from "../../../utils"

export const Route = createFileRoute("/_layout/files/")({
  component: Files,
  head: () => ({
    meta: [
      {
        title: "My Files | CPG Portal",
      },
    ],
  })
})

function FilesTable() {
  // Set the page size as needed (default 5 in this example)
  const pageSize = 20
  const queryClient = useQueryClient()

  // Remove the files query when the component unmounts, so that on re-entry we start fresh.
  useEffect(() => {
    return () => {
      queryClient.removeQueries({ queryKey: ["files", pageSize] })
    }
  }, [queryClient, pageSize])

  // Use useInfiniteQuery to fetch files
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["files", pageSize],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await FilesService.readFiles({
        query: { skip: (pageParam - 1) * pageSize, limit: pageSize},
      })
      return response.data
    },
    // Start at the first page.
    initialPageParam: 1,
    // If the returned page has as many items as pageSize, assume there is another page.
    getNextPageParam: (lastPage, pages) =>
      lastPage?.data.length === pageSize ? pages.length + 1 : undefined,
  })

  // Flatten the pages into one list of files.
  const files = data?.pages.filter(file => file !== undefined).flatMap((page) => page?.data) || []

  return (
    <>
      <TableContainer>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Tags</Th>
              <Th>Type</Th>
              <Th>Size</Th>
              <Th>Created</Th>
              <Th width="10%">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              // Show skeleton rows while loading the first page.
              new Array(pageSize).fill(null).map((_, idx) => (
                <Tr key={idx}>
                  {new Array(6).fill(null).map((_, i) => (
                    <Td key={i}>
                      <SkeletonText noOfLines={1} paddingBlock="16px" />
                    </Td>
                  ))}
                </Tr>
              ))
            ) : isError ? (
              // Display an error message if something went wrong.
              <Tr>
                <Td colSpan={6}>
                  <Text color="red.500">
                    Error: {(error as Error).message}
                  </Text>
                </Td>
              </Tr>
            ) : (
              // Render the loaded files.
              files.map((file) => (
                <Tr key={file.id}>
                  <Td>{file.name}</Td>
                  <Td>
                    {file.tags?.map((tag) => (
                      <Badge key={tag} colorScheme="cyan" mr={1}>
                        {tag}
                      </Badge>
                    ))}
                  </Td>
                  <Td>{file.file_type}</Td>
                  <Td>
                    {file.size ? humanReadableFileSize(file.size) : ""}
                  </Td>
                  <Td>{humanReadableDate(file.created_at)}</Td>
                  <Td>
                    <ButtonGroup size="sm">
                      <DownloadFileButton size="sm" file={file}  />
                      <DeleteFileButton file={file} />
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
            Load more files
          </Button>
        </Flex>
      )}
    </>
  )
}

function Files() {
  return (
    <Container maxW="full" px={{ base: 4, md: 6, lg: 8, xl: 12 }}>
      <Stack spacing={1} mb={2}>
        <Heading size="2xl" pt={6}>
          My Files
        </Heading>
        <Text>
          From here you can upload, download, and delete files associated with
          your account.
        </Text>
      </Stack>
      <Stack spacing={1} my={4}>
        <StorageStats size="md"/>
      </Stack> 
      <FileUpload dragAndDrop />
      <Flex justify="space-between" align="center" my={4}>
        <Stack spacing={1}>
          <Heading size="md">Saved files</Heading>
          <Text>Files that are associated with your account.</Text>
        </Stack>
        <DeleteFilesButton />
      </Flex>
      <FilesTable />
    </Container>
  )
}

export default Files
