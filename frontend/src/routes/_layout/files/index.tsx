import { useEffect, useState } from "react"
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
import UngroupButton from "../../../components/Files/UngroupButton"
import CreateGroupButton from "../../../components/Files/CreateGroupButton"
import StorageStats from "../../../components/Files/StorageStats"
import { FilesService } from "../../../client"
import { humanReadableDate, humanReadableFileSize } from "../../../utils"
import { BsFolder, BsFolder2Open } from "react-icons/bs"

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

interface FilesTableProps {
  selected: string[]
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
}

function FilesTable({ selected, setSelected }: FilesTableProps) {
  const pageSize = 20
  const queryClient = useQueryClient()

  useEffect(() => {
    return () => {
      queryClient.removeQueries({ queryKey: ["files", pageSize] })
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
    queryKey: ["files", pageSize],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await FilesService.readFiles({
        query: { skip: (pageParam - 1) * pageSize, limit: pageSize},
      })
      return response.data
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage?.data.length === pageSize ? pages.length + 1 : undefined,
  })

  const files = data?.pages.filter(file => file !== undefined).flatMap((page) => page?.data) || []

  // Get the file type of the first selected file
  const firstSelectedFile = selected.length > 0 ? files.find(f => f.id === selected[0]) : null
  const firstSelectedFileType = firstSelectedFile?.file_type

  // Checkbox handlers
  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const selectAll = () => {
    setSelected(files.filter(f => canSelectFile(f)).map(f => f.id))
  }
  const deselectAll = () => {
    setSelected([])
  }

  // Check if a file can be selected based on the first selected file's type
  const canSelectFile = (file: any) => {
    if (file.is_group) return false // Groups cannot be selected
    if (selected.length === 0) return true // First selection, any non-group file can be selected
    return file.file_type === firstSelectedFileType // Must match first selected file's type
  }

  return (
    <>
      <TableContainer>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th px={2} width="1%">
                
              </Th>
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
              new Array(pageSize).fill(null).map((_, idx) => (
                <Tr key={idx}>
                  <Td><SkeletonText noOfLines={1} paddingBlock="16px" /></Td>
                  {new Array(6).fill(null).map((_, i) => (
                    <Td key={i}>
                      <SkeletonText noOfLines={1} paddingBlock="16px" />
                    </Td>
                  ))}
                </Tr>
              ))
            ) : isError ? (
              <Tr>
                <Td colSpan={7}>
                  <Text color="red.500">
                    Error: {(error as Error).message}
                  </Text>
                </Td>
              </Tr>
            ) : (
              files.map((file) => (
                <Tr key={file.id}>
                  <Td px={2} width="1%">
                  {canSelectFile(file) && (
                    <input
                      type="checkbox"
                      aria-label={`Select file ${file.name}`}
                      checked={selected.includes(file.id)}
                      onChange={() => toggleSelect(file.id)}
                    />
                  )}
                  {file.is_group && ( <BsFolder />)}
                  </Td>
                  <Td>
                    {file.name}
                  </Td>
                  <Td>
                    {file.tags?.map((tag) => (
                      <Badge key={tag} colorScheme="cyan" mr={1}>
                        {tag}
                      </Badge>
                    ))}
                  </Td>
                  <Td>
                    {file.is_group ? `${file.file_type} (group)` : file.file_type === 'pair' ? 'paired-end reads' : file.file_type}
                  </Td>
                  <Td>
                    {file.size ? humanReadableFileSize(file.size) : ""}
                  </Td>
                  <Td>{humanReadableDate(file.created_at)}</Td>
                  <Td>
                    <ButtonGroup size="sm">
                      <DownloadFileButton file={file} size="sm" />
                      <UngroupButton file={file} size="sm" />
                      <DeleteFileButton file={file} />
                    </ButtonGroup>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </TableContainer>

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
  const [selected, setSelected] = useState<string[]>([])

  const handleGroupCreated = () => {
    setSelected([])
  }

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
        <ButtonGroup>
          <CreateGroupButton 
            selectedFileIds={selected}
            onGroupCreated={handleGroupCreated}
          />
          <DeleteFilesButton />
        </ButtonGroup>
      </Flex>
      <FilesTable selected={selected} setSelected={setSelected} />


    </Container>
  )
}

export default Files
