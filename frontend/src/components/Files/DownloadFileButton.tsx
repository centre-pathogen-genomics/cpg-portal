import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type FilePublic, FilesService } from "../../client"

interface DownloadFileButtonProps {
  file: FilePublic
  fileSize?: string
  size?: "xs" | "sm" | "md" | "lg"
}

const handleDownload = async (fileId: string) => {
  const token = (await FilesService.getDownloadToken({ path: { id: fileId } }))
    .data
  const downloadUrl = `${import.meta.env.VITE_API_URL}/api/v1/files/download/${token}`
  window.open(downloadUrl, "_blank")
}

const DownloadFileButton = ({
  file,
  fileSize,
  size,
}: DownloadFileButtonProps) => {
  const fileIds: string[] = []
  if (file.children && file.children.length > 0) {
    file.children.forEach((child) => {
      fileIds.push(child.id)
    })
  } else {
    fileIds.push(file.id)
  }
  return (
    <Button
      size={size === "xs" ? "sm" : size === "md" ? "default" : size}
      className={size === "xs" ? "h-6 px-2 text-xs" : undefined}
      onClick={() => fileIds.forEach(handleDownload)}
    >
      <Download /> Download{fileSize ? ` (${fileSize})` : ""}
    </Button>
  )
}

export default DownloadFileButton
