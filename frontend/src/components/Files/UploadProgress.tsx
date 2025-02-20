// UploadProgress.tsx
import React from "react";
import {
  Box,
  Flex,
  Text,
  Progress,
  IconButton,
  useColorModeValue,
} from "@chakra-ui/react";
import { FiX } from "react-icons/fi";
import { CheckIcon } from "@chakra-ui/icons";
import { humanReadableFileSize } from "../../utils";

interface UploadProgressProps {
  file: File;
  progress: number;
  completed?: boolean;
  onCancel: () => void;
}

const UploadProgress: React.FC<UploadProgressProps> = ({
  file,
  progress,
  completed,
  onCancel,
}) => {
  const bgColor = useColorModeValue("white", "gray.800");
  const colorScheme = progress < 100 || !completed ? "blue" : "green";

  return (
    <Flex
      align="center"
      justify="space-between"
      my={1}
      p={2}
      borderWidth={1}
      borderRadius="md"
      bg={bgColor}
    >
      <Box flex="1">
        <Text fontSize="sm" isTruncated>
          {file.name} ({humanReadableFileSize(file.size)})
        </Text>
        <Progress value={progress} size="xs" mt={1} colorScheme={colorScheme} />
      </Box>
      {(!completed && progress === 100) ? (
        <IconButton
          isLoading={true}
          aria-label="processing"
          variant="ghost"
          ml={4}
          h={8}
          size="sm"
        />
      ) : progress < 100 ? (
        <IconButton
          h={8}
          ml={4}
          size="sm"
          colorScheme="red"
          variant="outline"
          onClick={onCancel}
          aria-label="Cancel upload"
          icon={<FiX />}
        />
      ) : (
        <CheckIcon h={8} ml={4} mr={1} color="green.500" />
      )}
    </Flex>
  );
};

export default UploadProgress;
