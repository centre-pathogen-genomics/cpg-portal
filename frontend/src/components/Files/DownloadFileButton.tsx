import { Button } from "@chakra-ui/react"
import { DownloadIcon } from "@chakra-ui/icons"
import { FilePublic, FilesService} from "../../client"

interface DownloadFileButtonProps {
  file: FilePublic
  fileSize?: string
  size?: "xs" | "sm" | "md" | "lg"
}

const handleDownload = async (fileId: string) => {
  const token = (await FilesService.getDownloadToken({path: { id: fileId }})).data
  const downloadUrl = `${import.meta.env.VITE_API_URL}/api/v1/files/download/${token}`
  window.open(downloadUrl, "_blank")
}

const DownloadFileButton = ({ file, fileSize, size }: DownloadFileButtonProps ) => {
    const fileIds: string[] = []
    if (file.children && file.children.length > 0) {
        file.children.forEach(child => {
            fileIds.push(child.id)
        })
    } else {
        fileIds.push(file.id)
    }
    return (
      <Button 
        color="ui.main"
        variant="solid"
        size={size}
        leftIcon={<DownloadIcon />}
        onClick={() => fileIds.forEach(handleDownload)}
      >
        Download{fileSize ? ` (${fileSize})` : ""}
      </Button>
  )
}

export default DownloadFileButton
