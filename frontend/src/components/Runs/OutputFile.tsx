import { Flex, Heading, HStack, Icon, VStack } from "@chakra-ui/react"
import { HiOutlineDocument } from "react-icons/hi2"
import type { FilePublic } from "../../client"
import { humanReadableFileSize } from "../../utils"
import CopyFileButton from "../Files/CopyFileButton"
import DownloadFileButton from "../Files/DownloadFileButton"
import SaveFileButton from "../Files/SaveFileButton"

interface OutputFileProps {
  file: FilePublic
  copyFile?: boolean
}

function OutputFile({ file, copyFile }: OutputFileProps) {
  return (
    <Flex borderWidth="1px" borderRadius="lg" overflow="hidden" p={2}>
      <HStack spacing={2}>
        <Icon boxSize={8} as={HiOutlineDocument} />
        <VStack direction={"column"} justify={"start"} align={"start"}>
          <HStack spacing={2}>
            <Heading size={"sm"}>{file.name}</Heading>
          </HStack>
          <HStack spacing={2} minW={"300px"}>
            <DownloadFileButton
              size="xs"
              file={file}
              fileSize={
                file.size ? humanReadableFileSize(file.size) : "Unknown size"
              }
            />
            {copyFile ? (
              <CopyFileButton fileId={file.id} size="xs" />
            ) : (
              <SaveFileButton
                size="xs"
                fileId={file.id}
                saved={file.saved ? file.saved : false}
              />
            )}
          </HStack>
        </VStack>
      </HStack>
    </Flex>
  )
}

export default OutputFile
