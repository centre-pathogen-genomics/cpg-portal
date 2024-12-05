import { Button } from "@chakra-ui/react"
import { DownloadIcon } from "@chakra-ui/icons"
import { FilesService} from "../../client"

interface DownloadFileButtonProps {
  fileId: string
  size?: "sm" | "md" | "lg"
}

const handleDownload = async (fileId: string) => {
  const token = await FilesService.getDownloadToken({ id: fileId })
  const downloadUrl = `${import.meta.env.VITE_API_URL}/api/v1/files/download/${token}`
  window.open(downloadUrl, "_blank")
}

const DownloadFileButton = ({ fileId, size }: DownloadFileButtonProps ) => {
  return (
    <Button 
      color="ui.main"
      variant="solid"
      size={size}
      leftIcon={<DownloadIcon />}
      onClick={() => handleDownload(fileId)}>
      Download
    </Button>
  )
}

export default DownloadFileButton
