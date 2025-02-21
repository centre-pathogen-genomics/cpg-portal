import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Flex,
  Icon,
  Input,
  Text,
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
import UploadProgress from "./UploadProgress"; 

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

  const handleFileUpload = useCallback(
    (file: File) => {
      const controller = new AbortController();
      const uploadingFile: UploadingFile = {
        file,
        progress: 0,
        cancel: () => controller.abort(),
      };

      setUploadingFiles((prev) => [...prev, uploadingFile]);

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
          // Mark the file as completed
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.file === file ? { ...f, completed: true } : f
            )
          );
          // Remove the file after 3 seconds
          setTimeout(() => {
            setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
          }, 3000);
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["files"] });
          queryClient.invalidateQueries({
            queryKey: [{ _id: "getFilesStats" }],
          });
        })
        .catch((error) => {
          if (axios.isCancel(error)) {
            showToast(
              "Upload Canceled",
              `Upload of ${file.name} canceled`,
              "warning"
            );
          } else if (error.name === "UploadError") {
            showToast("Error!", error.message, "error");
          } else if (error.response.status === 413) {
            showToast(file.name, `${error.response.data.detail}`, "error");
          } else {
            showToast("Error!", `Failed to upload ${file.name}`, "error");
          }
          setUploadingFiles((prev) =>
            prev.filter((f) => f.file !== file)
          );
        });
    },
    [uploadFile, showToast, onComplete, queryClient]
  );

  // 2. Check file size before uploading; warn and skip if it exceeds MAX_FILE_UPLOAD_SIZE.
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
      handleFileUpload(file);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(false);
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      for (const file of event.dataTransfer.files) {
        handleFileUpload(file);
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <Flex direction="column" align="center" width="100%">
      <Flex
        direction="column"
        align="center"
        justify="center"
        p={4}
        borderWidth={2}
        borderRadius="md"
        borderStyle="dashed"
        borderColor={isDragging ? "blue.400" : useColorModeValue("gray.300", "gray.600")}
        bg={useColorModeValue("gray.100", "gray.700")}
        _hover={{ borderColor: "blue.400" }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        textAlign="center"
        position="relative"
        cursor="pointer"
        width="100%"
        height="150px"
      >
        <Icon
          as={HiDocumentArrowUp}
          w={10}
          h={10}
          mb={2}
          color={useColorModeValue("gray.600", "gray.400")}
        />
        <Text color={useColorModeValue("gray.600", "gray.400")} mb={0}>
          {isDragging ? <Text as="b">Drop here to upload!</Text> : <Text><Text as="b">Upload a file</Text> or drag and drop</Text>}
        </Text>
        <Text
          fontSize="sm"
          color={useColorModeValue("gray.500", "gray.500")}
        >
          Max file size {humanReadableFileSize(MAX_FILE_UPLOAD_SIZE)}
        </Text>
        <Input
          type="file"
          position="absolute"
          top="0"
          left="0"
          width="100%"
          height="100%"
          opacity="0"
          onChange={handleFileChange}
          cursor="pointer"
          multiple
          required={false}
        />
      </Flex>

      <Box width="100%">
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
      </Box>
    </Flex>
  );
};

export default FileUpload;
