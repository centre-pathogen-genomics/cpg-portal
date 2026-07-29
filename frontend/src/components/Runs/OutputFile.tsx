import { HiOutlineDocument } from "react-icons/hi2"
import type { FilePublic } from "../../client"
import { humanReadableFileSize } from "../../utils"
import CopyFileButton from "../Files/CopyFileButton"
import DownloadFileButton from "../Files/DownloadFileButton"
import SaveFileButton from "../Files/SaveFileButton"

interface OutputFileProps {
  file: FilePublic
  copyFile?: boolean
}

function OutputFile({ file, copyFile }: OutputFileProps) {
  return (
    <div className="overflow-hidden rounded-lg border p-2">
      <div className="flex items-center gap-2">
        <HiOutlineDocument className="size-8" />
        <div className="flex flex-col items-start justify-start">
          <div className="flex gap-2">
            <h3 className="text-sm font-semibold">{file.name}</h3>
          </div>
          <div className="flex min-w-[300px] gap-2">
            <DownloadFileButton
              size="xs"
              file={file}
              fileSize={
                file.size ? humanReadableFileSize(file.size) : "Unknown size"
              }
            />
            {copyFile ? (
              <CopyFileButton fileId={file.id} size="xs" />
            ) : (
              <SaveFileButton
                size="xs"
                fileId={file.id}
                saved={file.saved ? file.saved : false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OutputFile
