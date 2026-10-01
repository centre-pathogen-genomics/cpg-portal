import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type FilePublic, FilesService } from "../../client";

interface DownloadAllFilesButtonProps {
  files: FilePublic[];
}

const handleDownload = async (fileId: string) => {
  const token = (await FilesService.getDownloadToken({ path: { id: fileId } }))
    .data;
  const downloadUrl = `${import.meta.env.VITE_API_URL}/api/v1/files/download/${token}`;
  window.open(downloadUrl, "_blank");
};

function DownloadAllFilesButton({ files }: DownloadAllFilesButtonProps) {
  const fileIds = files.flatMap((file) =>
    file.children && file.children.length > 0
      ? file.children.map((child) => child.id)
      : [file.id],
  );

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => void Promise.all(fileIds.map(handleDownload))}
    >
      <Download /> Download All
    </Button>
  );
}

export default DownloadAllFilesButton;
