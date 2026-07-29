// components/UploadProgress.tsx

import type React from "react"
import { Progress } from "@/components/ui/progress"
import { useUpload } from "../../context/UploadContext"

const UploadProgress: React.FC = () => {
  const { isUploading, progress } = useUpload()

  if (!isUploading) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000]">
      <Progress value={progress} />
    </div>
  )
}

export default UploadProgress
