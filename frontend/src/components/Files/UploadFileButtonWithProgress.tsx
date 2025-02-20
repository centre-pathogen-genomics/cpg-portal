// FileUpload.tsx
import React, { useCallback, useState, useRef, useEffect } from "react";
import {
  Box,
  Flex,
  Icon,
  Input,
  Button,
  useColorModeValue,
} from "@chakra-ui/react";
import { Fade } from "@chakra-ui/react";
import { HiDocumentArrowUp } from "react-icons/hi2";
import { useUpload } from "../../context/UploadContext";
import useCustomToast from "../../hooks/useCustomToast";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { humanReadableFileSize } from "../../utils";
import { FilePublic } from "../../client";
import UploadProgress from "./UploadProgress"; // Import the reusable component

// Read the max file upload size from the environment, defaulting to 10 MB if missing.
const MAX_FILE_UPLOAD_SIZE =
  Number(import.meta.env.VITE_MAX_FILE_UPLOAD_SIZE) || 10485760;

interface UploadingFile {
  file: File;
  progress: number;
  cancel: () => void;
  completed?: boolean;
}

interface FileUploadProps {
  onComplete?: (file: FilePublic) => void;
}

const FileUpload = ({ onComplete }: FileUploadProps) => {
  const queryClient = useQueryClient();
  const { uploadFile } = useUpload();
  const showToast = useCustomToast();
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global state to track if a drag event is active
  const [isDragging, setIsDragging] = useState(false);
  // Counter to handle nested drag events properly
  const dragCounter = useRef(0);

  // Global drag events to update the isDragging state
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  // Process files from input or drag/drop events
  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of files) {
      if (file.size > MAX_FILE_UPLOAD_SIZE) {
        showToast(
          "Error!",
          `File ${file.name} (${humanReadableFileSize(
            file.size
          )}) exceeds the maximum allowed size of ${humanReadableFileSize(
            MAX_FILE_UPLOAD_SIZE
          )}.`,
          "error"
        );
        continue;
      }
      handleFileUpload(file);
    }
  };

  // Handle file upload with progress updates
  const handleFileUpload = useCallback(
    (file: File) => {
      const controller = new AbortController();
      const uploadingFile: UploadingFile = {
        file,
        progress: 0,
        cancel: () => controller.abort(),
      };

      setUploadingFiles((prev) => [...prev, uploadingFile]);
      setIsDragging(false);

      uploadFile(
        file,
        (progress) => {
          setUploadingFiles((prev) =>
            prev.map((f) => (f.file === file ? { ...f, progress } : f))
          );
        },
        onComplete,
        controller
      )
        .then(() => {
          // Mark file as completed
          setUploadingFiles((prev) =>
            prev.map((f) => (f.file === file ? { ...f, completed: true } : f))
          );
          // Remove the file from the list after 3 seconds
          setTimeout(() => {
            setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
          }, 3000);
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["files"] });
          queryClient.invalidateQueries({ queryKey: [{ _id: "getFilesStats" }] });
        })
        .catch((error) => {
          if (axios.isCancel(error)) {
            showToast("Upload Canceled", `Upload of ${file.name} canceled`, "warning");
          } else {
            if (error.response?.status === 413) {
              showToast(file.name, `${error.response.data.detail}`, "error");
            } else {
              showToast("Error!", `Failed to upload ${file.name}`, "error");
            }
          }
          setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
        });
    },
    [uploadFile, showToast, onComplete, queryClient]
  );

  // Handle file selection via the input
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(event.target.files);
    // Clear the input value to allow re-selection of the same file
    event.target.value = "";
  };

  // Trigger file input click when the button is pressed
  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle files dropped directly on the button
  const handleButtonDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    processFiles(event.dataTransfer.files);
    setIsDragging(false);
  };

  // Prevent default behavior for dragover on the button
  const handleButtonDragOver = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <Box w="100%">
      {/* Button to trigger file selection and act as a drop target */}
      <Button
        leftIcon={<Icon fontSize="22px" as={HiDocumentArrowUp} />}
        onClick={handleButtonClick}
        onDrop={handleButtonDrop}
        onDragOver={handleButtonDragOver}
        variant={isDragging ? "outline" : "solid"}
        cursor={isDragging ? "copy" : "pointer"}
        w="100%"
        h={isDragging ? "100px" : "40px"}
        mb={1}
        color={useColorModeValue("gray.600", "gray.400")}
        borderStyle={isDragging ? "dashed" : "solid"}
        borderWidth={isDragging ? "2px" : "0px"}
        borderColor={isDragging ? "blue.400" : useColorModeValue("gray.300", "gray.600")}
        size="md"
        disabled={uploadingFiles.length > 0}
        isLoading={uploadingFiles.filter((f) => f.progress < 100).length > 0}
      >
        {isDragging ? "Drop here to upload!" : "Upload a File or Drag and Drop"}
      </Button>

      {/* Hidden file input */}
      <Input
        type="file"
        ref={fileInputRef}
        display="none"
        onChange={handleFileChange}
        multiple
        required={false}
      />

      {/* Display upload progress for each file */}
      <Flex direction="column" w="100%">
        {uploadingFiles.map(({ file, progress, cancel, completed }) => (
          <Fade in={true} key={file.name}>
            <UploadProgress
              file={file}
              progress={progress}
              completed={completed}
              onCancel={cancel}
            />
          </Fade>
        ))}
      </Flex>
    </Box>
  );
};

export default FileUpload;
