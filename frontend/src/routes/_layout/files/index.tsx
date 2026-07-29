import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { BsFolder } from "react-icons/bs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { FileTypeEnum } from "../../../client"
import { FilesService } from "../../../client"
import { getFilesAllowedTypesOptions } from "../../../client/@tanstack/react-query.gen"
import CreateGroupButton from "../../../components/Files/CreateGroupButton"
import DeleteFileButton from "../../../components/Files/DeleteFileButton"
import DownloadFileButton from "../../../components/Files/DownloadFileButton"
import StorageStats from "../../../components/Files/StorageStats"
import UngroupButton from "../../../components/Files/UngroupButton"
import FileUpload from "../../../components/Files/UploadFileButtonWithProgress"
import { humanReadableDate, humanReadableFileSize } from "../../../utils"

export const Route = createFileRoute("/_layout/files/")({
  component: Files,
  head: () => ({ meta: [{ title: "My Files | CPG Portal" }] }),
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
  useEffect(
    () => () =>
      queryClient.removeQueries({ queryKey: ["files", pageSize, typeFilter] }),
    [queryClient, typeFilter],
  )
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
    queryFn: async ({ pageParam = 1 }) =>
      (
        await FilesService.readFiles({
          query: {
            skip: (pageParam - 1) * pageSize,
            limit: pageSize,
            ...(typeFilter && typeFilter !== "all"
              ? { types: [typeFilter as FileTypeEnum] }
              : {}),
          },
        })
      ).data,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage?.data.length === pageSize ? pages.length + 1 : undefined,
  })
  const files = data?.pages.flatMap((page) => page?.data ?? []) || []
  const selectedType = files.find((file) => file.id === selected[0])?.file_type
  const canSelect = (file: (typeof files)[number]) =>
    !file.is_group && (!selected.length || file.file_type === selectedType)
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    )

  return (
    <>
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[1%] px-2" />
              {["Name", "Tags", "Type", "Size", "Created", "Actions"].map(
                (heading) => (
                  <TableHead key={heading}>{heading}</TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              new Array(pageSize).fill(null).map((_, row) => (
                <TableRow key={row}>
                  {new Array(7).fill(null).map((_, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-5" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={7} className="text-destructive">
                  Error: {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : (
              files.map((file) => (
                <TableRow
                  key={file.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={(event) => {
                    if ((event.target as Element).closest("button, a, input"))
                      return
                    navigate({
                      to: "/files/$fileId",
                      params: { fileId: file.id },
                      search: { groupId: undefined },
                      resetScroll: true,
                    })
                  }}
                >
                  <TableCell className="w-[1%] px-2">
                    {canSelect(file) && (
                      <input
                        type="checkbox"
                        aria-label={`Select file ${file.name}`}
                        checked={selected.includes(file.id)}
                        onChange={() => toggle(file.id)}
                      />
                    )}
                    {file.is_group && <BsFolder />}
                  </TableCell>
                  <TableCell>{file.name}</TableCell>
                  <TableCell>
                    {file.tags?.map((tag) => (
                      <Badge
                        key={tag}
                        className="mr-1 bg-cyan-100 text-cyan-800 hover:bg-cyan-100"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell>
                    {file.is_group
                      ? `${file.file_type} (group)`
                      : file.file_type === "pair"
                        ? "paired-end reads"
                        : file.file_type}
                  </TableCell>
                  <TableCell>
                    {file.size ? humanReadableFileSize(file.size) : ""}
                  </TableCell>
                  <TableCell>{humanReadableDate(file.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <DownloadFileButton file={file} size="sm" />
                      <UngroupButton file={file} size="sm" />
                      <DeleteFileButton file={file} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {hasNextPage && (
        <div className="flex justify-center py-4">
          <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage && <LoaderCircle className="animate-spin" />}
            Load more files
          </Button>
        </div>
      )}
    </>
  )
}

function Files() {
  const [selected, setSelected] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState("all")
  const { data: fileTypes } = useQuery({ ...getFilesAllowedTypesOptions() })
  return (
    <div className="w-full px-4 md:px-6 lg:px-8 xl:px-12">
      <div className="mb-2 space-y-1">
        <h1 className="pt-6 text-4xl font-bold">My Files</h1>
        <p>
          From here you can upload, download, and delete files associated with
          your account.
        </p>
      </div>
      <div className="my-4">
        <StorageStats size="md" />
      </div>
      <FileUpload dragAndDrop />
      <div className="my-4 flex items-center justify-between">
        <select
          className="h-10 w-[150px] rounded-md border bg-background px-3"
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value)
            setSelected([])
          }}
        >
          <option value="all">Types</option>
          {fileTypes &&
            Object.entries(fileTypes).map(([key, metadata]: [string, any]) => (
              <option key={key} value={key}>
                {key.toUpperCase()} ({metadata.file_format})
              </option>
            ))}
        </select>
        <CreateGroupButton
          selectedFileIds={selected}
          onGroupCreated={() => setSelected([])}
          size="md"
        />
      </div>
      <FilesTable
        selected={selected}
        setSelected={setSelected}
        typeFilter={typeFilter}
      />
    </div>
  )
}

export default Files
