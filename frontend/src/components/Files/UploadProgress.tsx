// UploadProgress.tsx
import type React from "react"
import { FiAlertCircle, FiX } from "react-icons/fi"
import {
  Box,
  Flex,
  IconButton,
  Progress,
  Text,
  useColorModeValue,
} from "@/components/ui/chakra-compat"
import { CheckIcon } from "@/components/ui/chakra-icons-compat"
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
  const bgColor = useColorModeValue("white", "gray.800")
  const colorScheme = progress < 100 || !completed ? "blue" : "green"

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
      {error ? (
        <IconButton
          h={8}
          ml={4}
          size="sm"
          colorScheme="red"
          variant="outline"
          aria-label="Upload error"
          icon={<FiAlertCircle />}
          disabled
        />
      ) : !completed && progress === 100 ? (
        <IconButton
          isLoading={true}
          aria-label="Processing upload"
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
  )
}

export default UploadProgress
