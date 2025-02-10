import React, { useCallback, useState } from "react";
import {
  Box,
  Flex,
  Icon,
  Input,
  Progress,
  Text,
  IconButton,
  useColorModeValue,
} from "@chakra-ui/react";
import { HiDocumentArrowUp } from "react-icons/hi2";
import { FiX } from "react-icons/fi";
import { useUpload } from "../../context/UploadContext";
import useCustomToast from "../../hooks/useCustomToast";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { humanReadableFileSize } from "../../utils";
import { FilePublic } from "../../client";

// 1. Read the max file upload size from the environment. 
//    If the environment variable is missing, default to e.g. 20 MB 
const MAX_FILE_UPLOAD_SIZE = 
  Number(import.meta.env.VITE_MAX_FILE_UPLOAD_SIZE) || 20971520;
  
console.log("MAX_FILE_UPLOAD_SIZE", import.meta.env.VITE_MAX_FILE_UPLOAD_SIZE);

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
          showToast("Success!", `File ${file.name} uploaded successfully!`, "success");
          setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({
            queryKey: ['files'],
          });
          queryClient.invalidateQueries({
            queryKey: [{ "_id": "getFilesStats" }],
          });
        })
        .catch((error) => {
          if (axios.isCancel(error)) {
            showToast("Upload Canceled", `Upload of ${file.name} canceled`, "warning");
          } else {
            if (error.response.status === 413) {
              showToast(
                file.name,
                `${error.response.data.detail}`,
                "error"
              );
            } else {
              showToast("Error!", `Failed to upload ${file.name}`, "error");
            }
          }
          setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
        });
    },
    [uploadFile, showToast, onComplete, queryClient]
  );

  // 2. Check file size before uploading; skip and warn if it exceeds MAX_FILE_UPLOAD_SIZE.
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
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

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      for (const file of event.dataTransfer.files) {
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
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
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
        borderColor={useColorModeValue("gray.300", "gray.600")}
        bg={useColorModeValue("gray.100", "gray.700")}
        _hover={{ borderColor: "blue.400" }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        textAlign="center"
        position="relative"
        cursor="pointer"
        width="100%"
        height="150px"
      >
        <Icon as={HiDocumentArrowUp} w={10} h={10} mb={2} />
        <Text mb={0}><Text as='b'>Upload a file</Text> or drag and drop</Text>
        <Text fontSize="sm" color="gray.500">Max file size {humanReadableFileSize(MAX_FILE_UPLOAD_SIZE)}</Text>
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
        {uploadingFiles.map(({ file, progress, cancel }) => (
          <Flex
            key={file.name}
            align="center"
            justify="space-between"
            mb={2}
            p={2}
            borderWidth={1}
            borderRadius="md"
            bg={useColorModeValue("white", "gray.800")}
          >
            <Box flex="1">
              <Text fontSize="sm" isTruncated>
                {file.name} ({humanReadableFileSize(file.size)})
              </Text>
              <Progress value={progress} size="xs" mt={1} />
            </Box>
            <IconButton
              ml={4}
              size="sm"
              colorScheme="red"
              variant={"outline"}
              onClick={cancel}
              aria-label="Cancel upload"
              icon={<Icon as={FiX} />}
            />
          </Flex>
        ))}
      </Box>
    </Flex>
  );
};

export default FileUpload;
