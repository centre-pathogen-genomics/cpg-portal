import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { BsFileEarmarkText } from "react-icons/bs"
import { HiOutlineDocument, HiOutlineFolder } from "react-icons/hi"
import { HiCalendarDays, HiOutlineTag } from "react-icons/hi2"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { FilePublic } from "../../../client"
import { readFileOptions } from "../../../client/@tanstack/react-query.gen"
import DeleteFileButton from "../../../components/Files/DeleteFileButton"
import DownloadFileButton from "../../../components/Files/DownloadFileButton"
import EditableFileName from "../../../components/Files/EditableFileName"
import FileRenderer from "../../../components/Render/FileRenderer"
import { humanReadableDate, humanReadableFileSize } from "../../../utils"

export const Route = createFileRoute("/_layout/files/$fileId")({
  component: FileDetail,
  validateSearch: (search: Record<string, unknown>) => ({
    groupId: (search.groupId as string) || undefined,
  }),
})

function FileMetadata({ file }: { file: FilePublic }) {
  const items: Array<{
    icon: React.ReactNode
    title: string
    value: React.ReactNode
  }> = [
    {
      icon: file.is_group ? <HiOutlineFolder /> : <HiOutlineDocument />,
      title: "Type",
      value: (
        <Badge>
          {file.is_group
            ? `${file.file_type} (group)`
            : file.file_type === "pair"
              ? "paired-end reads"
              : file.file_type || "Unknown"}
        </Badge>
      ),
    },
    ...(file.size
      ? [
          {
            icon: <BsFileEarmarkText />,
            title: "Size",
            value: <span>{humanReadableFileSize(file.size)}</span>,
          },
        ]
      : []),
    {
      icon: <HiCalendarDays />,
      title: "Created",
      value: <span>{humanReadableDate(file.created_at)}</span>,
    },
    ...(file.tags?.length
      ? [
          {
            icon: <HiOutlineTag />,
            title: "Tags",
            value: (
              <div className="flex flex-wrap gap-2">
                {file.tags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-cyan-100 text-cyan-800 hover:bg-cyan-100"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            ),
          },
        ]
      : []),
    ...(file.is_group && file.children?.length
      ? [
          {
            icon: <HiOutlineFolder />,
            title: "Contents",
            value: (
              <div className="flex flex-col items-stretch gap-1">
                {file.children.map((child) => (
                  <div key={child.id} className="flex justify-between gap-4">
                    <Link
                      className="text-sm hover:text-primary hover:underline"
                      to="/files/$fileId"
                      params={{ fileId: child.id }}
                      search={{ groupId: file.id }}
                    >
                      {child.name}
                    </Link>
                    <Badge variant="secondary">{child.file_type}</Badge>
                  </div>
                ))}
              </div>
            ),
          },
        ]
      : []),
  ]
  return (
    <div className="flex flex-col">
      {items.map(({ icon, title, value }) => (
        <div key={title} className="mb-3 flex items-start">
          <div className="w-32 shrink-0">
            <div className="flex items-center">
              {icon}
              <span className="ml-2">{title}</span>
            </div>
          </div>
          <div className="flex items-center">{value}</div>
        </div>
      ))}
    </div>
  )
}

function FileDetailContent() {
  const { fileId } = Route.useParams()
  const { groupId } = Route.useSearch()
  const { data: file } = useSuspenseQuery({
    ...readFileOptions({ path: { id: fileId } }),
  })
  return (
    <div className="w-full max-w-5xl justify-self-center overflow-x-hidden px-2">
      <div className="flex items-center justify-between gap-2">
        {groupId ? (
          <Link
            to="/files/$fileId"
            params={{ fileId: groupId }}
            search={{ groupId: undefined }}
            className="font-semibold hover:text-primary"
          >
            ← Back to Group
          </Link>
        ) : (
          <Link to="/files" className="font-semibold hover:text-primary">
            ← Back to My Files
          </Link>
        )}
        <div className="flex gap-2">
          <DownloadFileButton file={file} size="sm" />
          <DeleteFileButton file={file} />
        </div>
      </div>
      <div className="mt-1 mb-2 flex items-start border-b">
        <EditableFileName key={file.name} file={file} />
      </div>
      <div className="mt-4 mb-2">
        <FileMetadata file={file} />
      </div>
      {!file.is_group && (
        <div className="mb-2">
          <h2 className="mb-4 text-lg font-semibold">Preview</h2>
          <FileRenderer file={file} />
        </div>
      )}
      {file.is_group && (
        <>
          <h2 className="mt-6 mb-4 text-lg font-semibold">Group Contents</h2>
          <p className="mb-4 text-gray-600">
            This is a file group containing {file.children?.length || 0} files.
          </p>
        </>
      )}
    </div>
  )
}

function FileDetail() {
  return (
    <div className="w-full">
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-5" />
            <Skeleton className="h-10" />
            <Skeleton className="h-[200px]" />
          </div>
        }
      >
        <ErrorBoundary
          fallbackRender={({ error }) => (
            <div className="text-destructive">
              Error: {error instanceof Error ? error.message : String(error)}
            </div>
          )}
        >
          <FileDetailContent />
        </ErrorBoundary>
      </Suspense>
    </div>
  )
}

export default FileDetail
