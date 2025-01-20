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
import { HiOutlineCloudUpload } from "react-icons/hi";
import { FiX } from "react-icons/fi";

import { useUpload } from "../../context/UploadContext";
import useCustomToast from "../../hooks/useCustomToast";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { humanReadableFileSize } from "../../utils";
import { type FilePublic } from "../../client";

interface UploadingFile {
  file: File;
  progress: number;
  cancel: () => void;
}

interface FileUploadProps {
  onComplete?: ((file: FilePublic) => void);
}

const FileUpload = ({onComplete}: FileUploadProps) => {
  const queryClient = useQueryClient()
  const { uploadFile } = useUpload();
  const showToast = useCustomToast();
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const handleFileUpload = useCallback(
    (file: File) => {
      const cancelTokenSource = axios.CancelToken.source(); // Use cancel tokens to handle cancellation

      const uploadingFile: UploadingFile = {
        file,
        progress: 0,
        cancel: () => cancelTokenSource.cancel("Upload canceled"),
      };

      setUploadingFiles((prev) => [...prev, uploadingFile]);

      uploadFile(file, (progress) => {
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.file === file ? { ...f, progress } : f
          )
        );
      }, onComplete)
        .then(() => {
          showToast("Success!", `File ${file.name} uploaded successfully!`, "success");
          setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
          queryClient.invalidateQueries({
            queryKey: ['files'],
          })
          // reset the stats cache
          queryClient.invalidateQueries({
            queryKey: [{"_id":"getFilesStats"}],
          })
        })
        .catch((error) => {
          if (axios.isCancel(error)) {
            showToast("Info", `Upload of ${file.name} canceled`, "success");
          } else {
            showToast("Error!", `Failed to upload ${file.name}`, "error");
          }
          setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
        });
    },
    [uploadFile, showToast]
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
      handleFileUpload(file);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
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
        mb={4}
      >
        <Icon as={HiOutlineCloudUpload} w={10} h={10} mb={2} color="blue.400" />
        <Text mb={2}>Drag and drop files here, or click to select files</Text>
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
          zIndex="1"
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
