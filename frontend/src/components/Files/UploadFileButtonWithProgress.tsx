// FileUpload.tsx

import { useMutation, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { HiDocumentArrowUp } from "react-icons/hi2"
import { Button } from "@/components/ui/button"
import type { FilePublic } from "../../client"
import { createPairMutation } from "../../client/@tanstack/react-query.gen"
import { useUpload } from "../../context/UploadContext"
import useCustomToast from "../../hooks/useCustomToast"
import { humanReadableFileSize } from "../../utils"
import UploadProgress from "./UploadProgress" // Import the reusable component
import { groupPairEndReadFiles } from "./utils"

// Read the max file upload size from the environment, defaulting to 10 MB if missing.
const MAX_FILE_UPLOAD_SIZE =
  Number(import.meta.env.VITE_MAX_FILE_UPLOAD_SIZE) || 10485760

interface UploadingFile {
  file: File
  progress: number
  cancel: () => void
  completed?: boolean
  error?: boolean
}

interface FileUploadProps {
  onStart?: (file: File) => void
  onEnd?: () => void
  onComplete?: (file: FilePublic) => void
  dragAndDrop?: boolean
  accept?: string[]
}

const FileUpload = ({
  onComplete,
  onStart,
  onEnd,
  dragAndDrop = false,
  accept,
}: FileUploadProps) => {
  const queryClient = useQueryClient()
  const { uploadFile } = useUpload()
  const showToast = useCustomToast()
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Global state to track if a drag event is active
  const [isDragging, setIsDragging] = useState(false)
  // Counter to handle nested drag events properly
  const dragCounter = useRef(0)

  const createPair = useMutation({
    ...createPairMutation(),
    onSuccess: (pair: FilePublic) => {
      if (pair.children?.length !== 2) {
        console.error("Pair creation failed!")
        return
      }
      showToast(
        "Success!",
        `FilePair ${pair.children[0].name} and ${pair.children[1].name} created successfully!`,
        "success",
      )
    },
    onError: (error) => {
      // Potential delete the files if the pair creation fails?
      console.error(error)
      showToast("Error!", "Failed to create FilePair", "error")
    },
  })

  // Global drag events to update the isDragging state
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current++
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true)
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current--
      if (dragCounter.current === 0) {
        setIsDragging(false)
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current = 0
      setIsDragging(false)
    }

    window.addEventListener("dragenter", handleDragEnter)
    window.addEventListener("dragleave", handleDragLeave)
    window.addEventListener("dragover", handleDragOver)
    window.addEventListener("drop", handleDrop)

    return () => {
      window.removeEventListener("dragenter", handleDragEnter)
      window.removeEventListener("dragleave", handleDragLeave)
      window.removeEventListener("dragover", handleDragOver)
      window.removeEventListener("drop", handleDrop)
    }
  }, [])

  // Process files from input or drag/drop events
  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    // find file pairs
    const filesToUpload = new Set<File>()
    for (const file of files) {
      if (file.size > MAX_FILE_UPLOAD_SIZE) {
        showToast(
          "Error!",
          `File ${file.name} (${humanReadableFileSize(
            file.size,
          )}) exceeds the maximum allowed size of ${humanReadableFileSize(
            MAX_FILE_UPLOAD_SIZE,
          )}.`,
          "error",
        )
        continue
      }
      filesToUpload.add(file)
    }
    const groupedSamples = groupPairEndReadFiles(Array.from(filesToUpload))
    console.log(groupedSamples)
    for (const fileOrPair of groupedSamples) {
      handleFileUpload(fileOrPair)
    }
  }

  const handleFileUpload = useCallback(
    (fileOrPair: File | [File, File]) => {
      // Determine if we have a pair of files.
      const files = Array.isArray(fileOrPair) ? fileOrPair : [fileOrPair]
      if (files.length > 2) {
        console.error("Too many files in a pair!")
        return
      }
      const isPair = files.length === 2

      // For each file, create an upload promise.
      const uploadPromises = files.map((file) => {
        const controller = new AbortController()
        const uploadingFile: UploadingFile = {
          file,
          progress: 0,
          cancel: () => controller.abort(),
        }

        // 1. Add file to the uploading list and trigger the start of the upload.
        setUploadingFiles((prev) => [...prev, uploadingFile])
        onStart?.(file)
        setIsDragging(false)

        // 2. Start the upload for this file.
        return uploadFile(
          file,
          (progress) => {
            // Update progress for the file.
            setUploadingFiles((prev) =>
              prev.map((f) => (f.file === file ? { ...f, progress } : f)),
            )
          },
          onComplete,
          controller,
        )
          .then((publicFile) => {
            // Mark the file as completed.
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.file === file ? { ...f, completed: true } : f,
              ),
            )
            // Resolve with the public file object.
            return publicFile
          })
          .catch((error) => {
            // Handle errors individually.
            if (axios.isCancel(error)) {
              showToast(
                "Upload Canceled",
                `Upload of ${file.name} canceled`,
                "warning",
              )
            } else {
              if (error.response?.status === 413) {
                showToast(file.name, `${error.response.data.detail}`, "error")
              } else {
                showToast("Error!", `Failed to upload ${file.name}`, "error")
              }
            }
            // Mark the file as having an error.
            setUploadingFiles((prev) =>
              prev.map((f) => (f.file === file ? { ...f, error: true } : f)),
            )
            // Re-throw to ensure Promise.all rejects if any upload fails.
            throw error
          })
      })

      // 3. Use Promise.all to wait for all file uploads.
      Promise.all(uploadPromises)
        .then((uploadedFiles) => {
          // Only for pairs: sort files and create the pair.
          if (isPair) {
            // Sort so that the first file is always the R1 file.
            uploadedFiles.sort((a, b) => a.name.localeCompare(b.name))
            console.log(uploadedFiles)
            const name = uploadedFiles[0].name
              .split("R1")[0]
              .trim()
              .replace(/^_+|_+$/g, "")
            createPair
              .mutateAsync({
                query: {
                  name: name,
                  forward: uploadedFiles[0].id,
                  reverse: uploadedFiles[1].id,
                },
              })
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ["files"] })
                queryClient.invalidateQueries({
                  queryKey: [{ _id: "getFilesStats" }],
                })
              })
          } else {
            // Invalidate the files query to refetch the list.
            queryClient.invalidateQueries({ queryKey: ["files"] })
            queryClient.invalidateQueries({
              queryKey: [{ _id: "getFilesStats" }],
            })
          }
        })
        .catch((err) => {
          // Optional: handle the overall error if one or more uploads fail.
          console.error("One or more uploads failed", err)
        })
        .finally(() => {
          // 4. Perform cleanup tasks only after all uploads have finished (either successfully or with errors).
          onEnd?.()
          // Remove each file from the uploading list after a delay.
          files.forEach((file) => {
            setTimeout(() => {
              setUploadingFiles((prev) =>
                prev.filter((f) => f.file.name !== file.name),
              )
            }, 3000)
          })
        })
    },
    [
      uploadFile,
      showToast,
      onComplete,
      queryClient,
      onStart,
      onEnd,
      createPair.mutateAsync,
    ],
  )

  // Handle file selection via the input
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(event.target.files)
    // Clear the input value to allow re-selection of the same file
    event.target.value = ""
  }

  // Trigger file input click when the button is pressed
  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Handle files dropped directly on the button
  const handleButtonDrop = (
    event: React.DragEvent<HTMLButtonElement | HTMLDivElement>,
  ) => {
    event.preventDefault()
    processFiles(event.dataTransfer.files)
    setIsDragging(false)
  }

  // Prevent default behavior for dragover on the button
  const handleButtonDragOver = (
    event: React.DragEvent<HTMLButtonElement | HTMLDivElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()
  }
  if (dragAndDrop) {
    return (
      <div className="flex w-full flex-col items-center">
        <div
          className={`relative flex h-[150px] w-full cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed bg-secondary p-4 text-center hover:border-blue-400 ${isDragging ? "border-blue-400" : "border-gray-300 dark:border-gray-600"}`}
        >
          <HiDocumentArrowUp className="mb-2 size-10 text-muted-foreground" />
          <div className="text-muted-foreground">
            {isDragging ? (
              <b>Drop here to upload!</b>
            ) : (
              <span>
                <b>Upload a file</b> or drag and drop
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Max file size {humanReadableFileSize(MAX_FILE_UPLOAD_SIZE)}
          </p>
          <input
            type="file"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={handleFileChange}
            onDrop={handleButtonDrop}
            onDragOver={handleButtonDragOver}
            multiple
            required={false}
            accept={accept?.join(",") ?? undefined} // how will the front end know the ext? 1. api 2. load on build 3. remove types just use exts and let the tool decide explicitly
          />
        </div>

        <div className="w-full">
          {uploadingFiles.map(
            ({ file, progress, cancel, completed, error }) => (
              <div key={file.name} className="animate-in fade-in">
                <UploadProgress
                  file={file}
                  progress={progress}
                  completed={completed}
                  error={error}
                  onCancel={cancel}
                />
              </div>
            ),
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="w-full">
      {/* Button to trigger file selection and act as a drop target */}
      <Button
        onClick={handleButtonClick}
        onDrop={handleButtonDrop}
        onDragOver={handleButtonDragOver}
        variant={isDragging ? "outline" : "default"}
        className={`mb-1 w-full text-muted-foreground ${isDragging ? "h-[100px] cursor-copy border-2 border-dashed border-blue-400" : "h-10"}`}
        disabled={uploadingFiles.length > 0}
      >
        <HiDocumentArrowUp className="size-[22px]" />
        {isDragging ? "Drop here to upload!" : "Upload a File or Drag and Drop"}
      </Button>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        multiple
        required={false}
        accept={accept?.join(",") ?? undefined}
      />

      {/* Display upload progress for each file */}
      <div className="flex w-full flex-col">
        {uploadingFiles.map(
          ({ file, progress, cancel, completed, error }, index) => (
            <div className="animate-in fade-in" key={index}>
              <UploadProgress
                file={file}
                progress={progress}
                completed={completed}
                error={error}
                onCancel={cancel}
              />
            </div>
          ),
        )}
      </div>
    </div>
  )
}

export default FileUpload
