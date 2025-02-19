import React, { useCallback, useState, useRef, useEffect } from "react";
import {
  Box,
  Flex,
  Icon,
  Input,
  Progress,
  Text,
  IconButton,
  useColorModeValue,
  Button,
} from "@chakra-ui/react";
import { Fade } from "@chakra-ui/react";
import { HiDocumentArrowUp } from "react-icons/hi2";
import { FiX } from "react-icons/fi";
import { CheckIcon } from "@chakra-ui/icons";
import { useUpload } from "../../context/UploadContext";
import useCustomToast from "../../hooks/useCustomToast";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { humanReadableFileSize } from "../../utils";
import { FilePublic } from "../../client";

// Read the max file upload size from the environment, defaulting to 10 MB if missing.
const MAX_FILE_UPLOAD_SIZE =
  Number(import.meta.env.VITE_MAX_FILE_UPLOAD_SIZE) || 10485760;

interface UploadingFile {
  file: File;
  progress: number;
  cancel: () => void;
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

  // Global drag events to update the isDragging state (used for changing the button text)
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

  // Function to process files (either from the file input or a drop event)
  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of files) {
      if (file.size > MAX_FILE_UPLOAD_SIZE) {
        showToast(
          "Error!",
          `File ${file.name} (${humanReadableFileSize(file.size)}) exceeds the maximum allowed size of ${humanReadableFileSize(
            MAX_FILE_UPLOAD_SIZE
          )}.`,
          "error"
        );
        continue;
      }
      handleFileUpload(file);
    }
  };

  // Function to handle file upload with progress updates.
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

  // Handle file selection from the file input.
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(event.target.files);
    // Clear the input value so that the same file can be selected again if needed.
    event.target.value = "";
  };

  // Trigger the file input click when the button is pressed.
  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle files dropped directly on the button.
  const handleButtonDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    processFiles(event.dataTransfer.files);
    setIsDragging(false);
  };

  // Prevent default behavior for dragover on the button.
  const handleButtonDragOver = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <Box w="100%">
      {/* Display upload progress for each uploading file */}
      <Flex direction="column" w="100%">
        {uploadingFiles.map(({ file, progress, cancel }) => (
          <Fade in={true} key={file.name}>
            <Flex
              align="center"
              justify="space-between"
              mb={1}
              p={2}
              borderWidth={1}
              borderRadius="md"
              bg={useColorModeValue("white", "gray.800")}
            >
              <Box flex="1">
                <Text fontSize="sm" isTruncated>
                  {file.name} ({humanReadableFileSize(file.size)})
                </Text>
                <Progress
                  value={progress}
                  size="xs"
                  mt={1}
                  colorScheme={progress < 100 ? "blue" : "green"}
                />
              </Box>
              {progress < 100 ? (
                <IconButton
                  h={8}
                  ml={4}
                  size="sm"
                  colorScheme="red"
                  variant="outline"
                  onClick={cancel}
                  aria-label="Cancel upload"
                  icon={<Icon as={FiX} />}
                />
              ) : (
                <CheckIcon h={8} ml={4} mr={1} color="green.500" />
              )}
            </Flex>
          </Fade>
        ))}
      </Flex>

      {/* Button to trigger file selection.
          It now also acts as a drop target so that files dropped on it are uploaded. */}
      <Button
        leftIcon={<Icon as={HiDocumentArrowUp} />}
        onClick={handleButtonClick}
        onDrop={handleButtonDrop}
        onDragOver={handleButtonDragOver}
        variant={isDragging ? "outline" : "solid"}
        w="100%"
        size="md"
        disabled={uploadingFiles.length > 0}
        isLoading={uploadingFiles.filter((f) => f.progress < 100).length > 0}
      >
        {isDragging ? "Drop files here to upload" : "Upload a File"}
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
    </Box>
  );
};

export default FileUpload;
