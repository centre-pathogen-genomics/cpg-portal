import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  LoaderCircle,
  MoreVertical,
  Search,
} from "lucide-react"
import { useEffect, useState } from "react"
import { BsFolder } from "react-icons/bs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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
import { ConfirmationDialog } from "../../../components/Common/ConfirmationDialog"
import useCustomToast from "../../../hooks/useCustomToast"
import { humanReadableDate, humanReadableFileSize } from "../../../utils"

export const Route = createFileRoute("/_layout/files/")({
  component: Files,
  head: () => ({ meta: [{ title: "My Files | CPG Portal" }] }),
})

interface FilesTableProps {
  selected: string[]
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
  typeFilter?: string
  nameFilter: string
  orderBy: string
  setOrderBy: React.Dispatch<React.SetStateAction<string>>
}

type SortColumn = "name" | "file_type" | "size" | "created_at"

const sortLabels: Record<SortColumn, string> = {
  name: "Name",
  file_type: "Type",
  size: "Size",
  created_at: "Created",
}

type DeleteMode = "current" | "all"

interface FilesActionsMenuProps {
  currentCount: number
  allCount: number
  nameFilter: string
  typeFilter: string
  onDeleted: () => void
}

function FilesActionsMenu({
  currentCount,
  allCount,
  nameFilter,
  typeFilter,
  onDeleted,
}: FilesActionsMenuProps) {
  const [deleteMode, setDeleteMode] = useState<DeleteMode | null>(null)
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const trimmedNameFilter = nameFilter.trim()
  const deleteCount = deleteMode === "current" ? currentCount : allCount

  const mutation = useMutation({
    mutationFn: async (mode: DeleteMode) => {
      await FilesService.deleteFiles({
        query:
          mode === "current"
            ? {
                ...(trimmedNameFilter ? { name: trimmedNameFilter } : {}),
                ...(typeFilter !== "all"
                  ? { types: [typeFilter as FileTypeEnum] }
                  : {}),
                top_level_only: true,
              }
            : {},
      })
    },
    onSuccess: () => {
      showToast("Success", "Files deleted successfully.", "success")
      onDeleted()
      setDeleteMode(null)
    },
    onError: () => {
      showToast("An error occurred.", "Failed to delete files.", "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] })
      queryClient.invalidateQueries({ queryKey: ["files-count"] })
      queryClient.invalidateQueries({ queryKey: [{ _id: "getFilesStats" }] })
    },
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="File actions">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            disabled={currentCount === 0}
            onSelect={() => setDeleteMode("current")}
          >
            Delete Current ({currentCount})
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={allCount === 0}
            onSelect={() => setDeleteMode("all")}
          >
            Delete All ({allCount})
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationDialog
        open={deleteMode !== null}
        onOpenChange={(open) => !open && setDeleteMode(null)}
        title={
          deleteMode === "current" ? "Delete Current Files" : "Delete All Files"
        }
        description={`Are you sure you want to delete ${deleteCount} file${
          deleteCount === 1 ? "" : "s"
        }? This action cannot be undone.`}
        confirmLabel={
          deleteMode === "current" ? "Delete Current" : "Delete all"
        }
        pending={mutation.isPending}
        onConfirm={() => {
          if (deleteMode) mutation.mutate(deleteMode)
        }}
      />
    </>
  )
}

function FilesTable({
  selected,
  setSelected,
  typeFilter,
  nameFilter,
  orderBy,
  setOrderBy,
}: FilesTableProps) {
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const navigate = useNavigate({ from: Route.fullPath })
  const trimmedNameFilter = nameFilter.trim()
  useEffect(() => {
    setPage(1)
  }, [typeFilter, trimmedNameFilter, orderBy, pageSize])
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ["files", pageSize, page, typeFilter, trimmedNameFilter, orderBy],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await FilesService.readFiles({
          query: {
            skip: (page - 1) * pageSize,
            limit: pageSize,
            ...(typeFilter && typeFilter !== "all"
              ? { types: [typeFilter as FileTypeEnum] }
              : {}),
            ...(trimmedNameFilter ? { name: trimmedNameFilter } : {}),
            order_by: orderBy,
          },
        })
      ).data,
  })
  const files = data?.data ?? []
  const totalCount = data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasPreviousPage = page > 1
  const hasNextPage = page < pageCount
  const firstItem = totalCount ? (page - 1) * pageSize + 1 : 0
  const lastItem = Math.min(page * pageSize, totalCount)
  const firstVisiblePage = Math.min(Math.max(page - 2, 1), Math.max(pageCount - 4, 1))
  const visiblePages = Array.from(
    { length: Math.min(5, pageCount) },
    (_, index) => firstVisiblePage + index,
  )
  const selectedType = files.find((file) => file.id === selected[0])?.file_type
  const canSelect = (file: (typeof files)[number]) =>
    !file.is_group && (!selected.length || file.file_type === selectedType)
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    )
  const sortFiles = (column: SortColumn) => {
    setSelected([])
    setOrderBy((current) => (current === column ? `-${column}` : column))
  }
  const changePage = (nextPage: number) => {
    setSelected([])
    setPage(Math.min(Math.max(nextPage, 1), pageCount))
  }
  const changePageSize = (nextPageSize: number) => {
    setSelected([])
    setPageSize(nextPageSize)
  }
  const renderSortableHeading = (column: SortColumn) => {
    const isAscending = orderBy === column
    const isDescending = orderBy === `-${column}`
    const Icon = isAscending ? ArrowUp : isDescending ? ArrowDown : ArrowUpDown

    return (
      <Button
        variant="ghost"
        className="-ml-3 h-8 px-3"
        onClick={() => sortFiles(column)}
        aria-label={`Sort files by ${sortLabels[column]}`}
      >
        {sortLabels[column]}
        <Icon className="ml-2 h-4 w-4" />
      </Button>
    )
  }

  return (
    <>
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[1%] px-2" />
              <TableHead>{renderSortableHeading("name")}</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>{renderSortableHeading("file_type")}</TableHead>
              <TableHead>{renderSortableHeading("size")}</TableHead>
              <TableHead>{renderSortableHeading("created_at")}</TableHead>
              <TableHead>Actions</TableHead>
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
            ) : files.length ? (
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
                      <Checkbox
                        aria-label={`Select file ${file.name}`}
                        checked={selected.includes(file.id)}
                        onCheckedChange={() => toggle(file.id)}
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
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No files found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="text-sm text-muted-foreground">
            Showing {firstItem} to {lastItem} of {totalCount} files
            {isFetching && !isLoading && (
              <LoaderCircle className="ml-2 inline h-4 w-4 animate-spin" />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Rows per page
            <select
              className="h-8 rounded-md border bg-background px-2 text-foreground"
              value={pageSize}
              onChange={(event) => changePageSize(Number(event.target.value))}
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => changePage(page - 1)}
            disabled={!hasPreviousPage}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {visiblePages.map((pageNumber) => (
              <Button
                key={pageNumber}
                variant={pageNumber === page ? "outline" : "ghost"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => changePage(pageNumber)}
                aria-label={`Go to page ${pageNumber}`}
                aria-current={pageNumber === page ? "page" : undefined}
              >
                {pageNumber}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => changePage(page + 1)}
            disabled={!hasNextPage}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  )
}

function Files() {
  const [selected, setSelected] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState("all")
  const [nameFilter, setNameFilter] = useState("")
  const [orderBy, setOrderBy] = useState("-created_at")
  const trimmedNameFilter = nameFilter.trim()
  const { data: fileTypes } = useQuery({ ...getFilesAllowedTypesOptions() })
  const { data: currentFilesCount } = useQuery({
    queryKey: ["files-count", "current", typeFilter, trimmedNameFilter],
    queryFn: async () =>
      (
        await FilesService.readFiles({
          query: {
            skip: 0,
            limit: 1,
            ...(typeFilter !== "all"
              ? { types: [typeFilter as FileTypeEnum] }
              : {}),
            ...(trimmedNameFilter ? { name: trimmedNameFilter } : {}),
          },
        })
      ).data?.count ?? 0,
  })
  const { data: allFilesCount } = useQuery({
    queryKey: ["files-count", "all"],
    queryFn: async () =>
      (
        await FilesService.readFiles({
          query: { skip: 0, limit: 1 },
        })
      ).data?.count ?? 0,
  })
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
      <div className="my-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={nameFilter}
              onChange={(event) => {
                setNameFilter(event.target.value)
                setSelected([])
              }}
              placeholder="Search by name"
              aria-label="Search files by name"
            />
          </div>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 sm:w-[150px]"
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value)
              setSelected([])
            }}
          >
            <option value="all">Types</option>
            {fileTypes &&
              Object.entries(fileTypes).map(
                ([key, metadata]: [string, any]) => (
                  <option key={key} value={key}>
                    {key.toUpperCase()} ({metadata.file_format})
                  </option>
                ),
              )}
          </select>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CreateGroupButton
            selectedFileIds={selected}
            onGroupCreated={() => setSelected([])}
            size="md"
          />
          <FilesActionsMenu
            currentCount={currentFilesCount ?? 0}
            allCount={allFilesCount ?? 0}
            nameFilter={nameFilter}
            typeFilter={typeFilter}
            onDeleted={() => setSelected([])}
          />
        </div>
      </div>
      <FilesTable
        selected={selected}
        setSelected={setSelected}
        typeFilter={typeFilter}
        nameFilter={nameFilter}
        orderBy={orderBy}
        setOrderBy={setOrderBy}
      />
    </div>
  )
}

export default Files
