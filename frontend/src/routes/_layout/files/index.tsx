import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { FilesPublic, FilesService } from "../../../client" // Import updated service
import { Button, ButtonGroup, Container, Flex, Heading, Input, InputProps, Skeleton, Table, TableContainer, Tbody, Td, Th, Thead, Tr, useMultiStyleConfig } from '@chakra-ui/react'
import FileDropZone from "../../../components/Files/FileUploadButton"
import DeleteFileButton from "../../../components/Files/DeleteFileButton"
import { DownloadIcon } from "@chakra-ui/icons"

export const Route = createFileRoute("/_layout/files/")({
  component: Files,
})

const handleDownload = (fileId: string) => {
  const downloadUrl = `${import.meta.env.VITE_API_URL}/api/v1/files/${fileId}/download`
  window.open(downloadUrl, "_blank")
}

// Custom hook to poll files
function usePollFiles() {
  const fetchFiles = async () => {
    const response = await FilesService.readFiles()
    return response // Ensure we're returning the data array
  }

  // Use useSuspenseQuery for handling data fetching with suspense
  const { data, refetch, status } = useSuspenseQuery<FilesPublic, Error>({
    queryKey: ["files"],
    queryFn: fetchFiles,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  })

  return { data, refetch, status }
}

function FilesTableBody() {
  const { data } = usePollFiles()
  const files = data?.data || [] // Update tasks array
  return (
    <Tbody>
      {files.map(
        (file) => (
          <Tr key={file.id}>
            <Td>
              {file.name}
            </Td>
            <Td>
              {file.created_at}
            </Td>
            <Td>
              
              <ButtonGroup size="sm">
                <Button 
                  color="ui.main"
                  variant="solid"
                  leftIcon={<DownloadIcon />}
                  onClick={() => handleDownload(file.id)}>
                  Download
                </Button>
                <DeleteFileButton file={file} />
              </ButtonGroup>
            </Td>
          </Tr>
        ),
      )}
    </Tbody>
  )
}

function FilesTable() {
  return (
    <TableContainer>
      <Table size={{ base: "sm", md: "md" }}>
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Created</Th>
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
            <FilesTableBody />
          </Suspense>
        </ErrorBoundary>
      </Table>
    </TableContainer>
  )
}

function Actions() {
  const { refetch } = usePollFiles() // Destructure refetch from usePollFiles

  return (
    <Flex gap={4} mb={4} justify={"space-between"}>
      <Flex gap={4} >
      <Suspense fallback={<Skeleton height="20px" width="20px" />}>
        <FileDropZone onUpload={() => refetch()} />
      </Suspense>
      
      </Flex>
      <Button 
        gap={1}
        fontSize={{ base: "sm", md: "inherit" }}
        onClick={() => refetch()} colorScheme="blue">
          Refresh
      </Button>
  
    </Flex>
  )
}

function Files() {
  return (
    <Suspense fallback={<Skeleton height="20px" width="20px" />}>
      <Container maxW="full">
        <Heading
          size="lg"
          textAlign={{ base: "center", md: "left" }}
          pt={12}
          pb={8}
        >
          Files
        </Heading>
        <Actions />
        <FilesTable />
      </Container>
    </Suspense>
  )
}
