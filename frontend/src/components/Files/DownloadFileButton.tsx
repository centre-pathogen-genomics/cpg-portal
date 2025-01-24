import { Button } from "@chakra-ui/react"
import { DownloadIcon } from "@chakra-ui/icons"
import { FilesService} from "../../client"

interface DownloadFileButtonProps {
  fileId: string
  fileSize?: string
  size?: "xs" | "sm" | "md" | "lg"
}

const handleDownload = async (fileId: string) => {
  const token = (await FilesService.getDownloadToken({path: { id: fileId }})).data
  const downloadUrl = `${import.meta.env.VITE_API_URL}/api/v1/files/download/${token}`
  window.open(downloadUrl, "_blank")
}

const DownloadFileButton = ({ fileId, fileSize, size }: DownloadFileButtonProps ) => {
  return (
    <Button 
      color="ui.main"
      variant="solid"
      size={size}
      leftIcon={<DownloadIcon />}
      onClick={() => handleDownload(fileId)}>
      Download{fileSize ? ` (${fileSize})` : ""}
    </Button>
  )
}

export default DownloadFileButton
