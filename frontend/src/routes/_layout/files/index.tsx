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
  useColorModeValue,
} from "@chakra-ui/react"
import { Select } from "chakra-react-select"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import FileUpload from "../../../components/Files/UploadFileButtonWithProgress"
import DeleteFileButton from "../../../components/Files/DeleteFileButton"
import DownloadFileButton from "../../../components/Files/DownloadFileButton"
import UngroupButton from "../../../components/Files/UngroupButton"
import CreateGroupButton from "../../../components/Files/CreateGroupButton"
import StorageStats from "../../../components/Files/StorageStats"
import { FilesService } from "../../../client"
import { getFilesAllowedTypesOptions } from "../../../client/@tanstack/react-query.gen"
import { humanReadableDate, humanReadableFileSize } from "../../../utils"
import { BsFolder } from "react-icons/bs"

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
  typeFilter?: string
}

function FilesTable({ selected, setSelected, typeFilter }: FilesTableProps) {
  const pageSize = 20
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: Route.fullPath })
  const colourMode = useColorModeValue("gray.50", "gray.700")

  useEffect(() => {
    return () => {
      queryClient.removeQueries({ queryKey: ["files", pageSize, typeFilter] })
    }
  }, [queryClient, pageSize, typeFilter])

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["files", pageSize, typeFilter],
    queryFn: async ({ pageParam = 1 }) => {
      const queryParams: any = { 
        skip: (pageParam - 1) * pageSize, 
        limit: pageSize 
      }
      
      if (typeFilter && typeFilter !== 'all') {
        queryParams.types = [typeFilter]
      }
      
      const response = await FilesService.readFiles({
        query: queryParams,
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
                <Tr key={file.id}
                  _hover={{ bg: colourMode }}
                  cursor="pointer"
                  onClick={() =>
                    navigate({
                      to: `/files/${file.id.toString()}`,
                      params: { fileid: file.id.toString() },
                      replace: false,
                      resetScroll: true,
                    })
                  }
                >
                  <Td px={2} width="1%"
                  onClick={(e) => {
                        e.stopPropagation()
                      }}
                  >
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
                    <ButtonGroup size="sm"
                     onClick={(e) => {
                        e.stopPropagation()
                      }}>
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
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Query for available file types
  const { data: fileTypes } = useQuery({
    ...getFilesAllowedTypesOptions(),
  })

  const handleGroupCreated = () => {
    setSelected([])
  }

  // Reset selection when filter changes
  const handleFilterChange = (newFilter: string) => {
    setTypeFilter(newFilter)
    setSelected([]) // Clear selection when filter changes
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
        <ButtonGroup>
          <Select
            value={{ label: typeFilter === 'all' ? 'Types' : typeFilter.toUpperCase(), value: typeFilter }}
            onChange={(selectedOption) => handleFilterChange(selectedOption?.value || 'all')}
            options={[
              { label: '--', value: 'all' },
              ...(fileTypes ? Object.entries(fileTypes || {}).map(([key, metadata]: [string, any]) => ({
                label: `${key.toUpperCase()} (${metadata.file_format})`,
                value: key
              })) : [])
            ]}
            placeholder="Select file type"
            isClearable={false}
            isSearchable={true}
            size="md"
            chakraStyles={{
              container: (provided) => ({
                ...provided,
                width: '150px'
              })
            }}
          />
        </ButtonGroup>
        <ButtonGroup>
          <CreateGroupButton 
            selectedFileIds={selected}
            onGroupCreated={handleGroupCreated}
            size="md"
          />
        </ButtonGroup>
      </Flex>
      <FilesTable selected={selected} setSelected={setSelected} typeFilter={typeFilter} />


    </Container>
  )
}

export default Files
