import { FilePublic } from "../../client"
import { Flex, Heading, HStack, Icon, VStack } from "@chakra-ui/react"
import DownloadFileButton from "../Files/DownloadFileButton"
import SaveFileButton from "../Files/SaveFileButton"
import { HiOutlineDocument } from "react-icons/hi2";
import { humanReadableFileSize } from "../../utils";


interface OutputFileProps {
    file: FilePublic;
}

function OutputFile({ file }: OutputFileProps) {
  return (
    <Flex borderWidth='1px' borderRadius='lg' overflow='hidden' p={2}>
        <HStack spacing={2}>
            <Icon boxSize={8} as={HiOutlineDocument} />
            <VStack direction={'column'} justify={'start'} align={'start'} >
                <HStack spacing={2}>
                    <Heading size={'sm'} >{file.name}</Heading>
                </HStack> 
                <HStack spacing={2} minW={"300px"}>
                    <DownloadFileButton size="xs" fileId={file.id} fileSize={file.size ? humanReadableFileSize(file.size): "Unknown size"} />
                    <SaveFileButton size="xs" fileId={file.id} saved={file.saved ? file.saved : false } />
                </HStack>
            </VStack>
        </HStack>
    </Flex>
  );
}

export default OutputFile;