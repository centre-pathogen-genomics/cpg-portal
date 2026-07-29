// UploadProgress.tsx

import { Check, LoaderCircle } from "lucide-react"
import type React from "react"
import { FiAlertCircle, FiX } from "react-icons/fi"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { humanReadableFileSize } from "../../utils"

interface UploadProgressProps {
  file: File
  progress: number
  completed?: boolean
  error?: boolean
  onCancel: () => void
}

const UploadProgress: React.FC<UploadProgressProps> = ({
  file,
  progress,
  completed,
  error,
  onCancel,
}) => {
  return (
    <div className="my-1 flex items-center justify-between rounded-md border bg-background p-2">
      <div className="flex-1">
        <p className="truncate text-sm">
          {file.name} ({humanReadableFileSize(file.size)})
        </p>
        <Progress value={progress} className="mt-1 h-1" />
      </div>
      {error ? (
        <Button
          className="ml-4 h-8"
          size="icon-sm"
          variant="outline"
          aria-label="Upload error"
          disabled
        >
          <FiAlertCircle />
        </Button>
      ) : !completed && progress === 100 ? (
        <Button
          disabled
          aria-label="Processing upload"
          variant="ghost"
          className="ml-4 h-8"
          size="icon-sm"
        >
          <LoaderCircle className="animate-spin" />
        </Button>
      ) : progress < 100 ? (
        <Button
          className="ml-4 h-8"
          size="icon-sm"
          variant="outline"
          onClick={onCancel}
          aria-label="Cancel upload"
        >
          <FiX />
        </Button>
      ) : (
        <Check className="mr-1 ml-4 size-8 text-green-500" />
      )}
    </div>
  )
}

export default UploadProgress
