import { Download } from "lucide-react"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  getDownloadableFileIds,
  useDownloadAllFiles,
} from "@/hooks/useDownloadAllFiles"
import type { FilePublic } from "../../client"

interface DownloadAllFilesButtonProps {
  files: FilePublic[]
  zipFileName?: string | null
}

function DownloadAllFilesButton({
  files,
  zipFileName,
}: DownloadAllFilesButtonProps) {
  const { downloadAll, isDownloading } = useDownloadAllFiles()
  const fileCount = useMemo(() => getDownloadableFileIds(files).length, [files])

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isDownloading || fileCount === 0}
      onClick={() => void downloadAll(files, zipFileName)}
    >
      <Download /> {isDownloading ? "Downloading..." : "Download All"}
    </Button>
  )
}

export default DownloadAllFilesButton
