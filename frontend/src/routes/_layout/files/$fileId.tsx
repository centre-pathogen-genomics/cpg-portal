import {
  Box,
  Container,
  Flex,
  Heading,
  Skeleton,
  Text,
  Badge,
  VStack,
  HStack,
  ButtonGroup,
  Icon,
} from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { HiOutlineDocument, HiOutlineFolder } from "react-icons/hi";
import { HiCalendarDays, HiOutlineTag } from "react-icons/hi2";
import { BsFileEarmarkText } from "react-icons/bs";
import { FilePublic } from "../../../client";
import FileRenderer from "../../../components/Render/FileRenderer";
import { readFileOptions } from "../../../client/@tanstack/react-query.gen";
import DownloadFileButton from "../../../components/Files/DownloadFileButton";
import DeleteFileButton from "../../../components/Files/DeleteFileButton";
import EditableFileName from "../../../components/Files/EditableFileName";
import { humanReadableDate, humanReadableFileSize } from "../../../utils";

export const Route = createFileRoute("/_layout/files/$fileId")({
  component: FileDetail,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      groupId: (search.groupId as string) || undefined,
    };
  },
});



function FileMetadata({ file }: { file: FilePublic }) {
  const items = [
    { 
      icon: file.is_group ? HiOutlineFolder : HiOutlineDocument, 
      title: "Type", 
      value: (
        <Badge colorScheme="blue">
          {file.is_group ? `${file.file_type} (group)` : 
           file.file_type === 'pair' ? 'paired-end reads' : 
           file.file_type || 'Unknown'}
        </Badge>
      )
    },
    ...(file.size ? [{ 
      icon: BsFileEarmarkText, 
      title: "Size", 
      value: <Text>{humanReadableFileSize(file.size)}</Text>
    }] : []),
    { 
      icon: HiCalendarDays, 
      title: "Created", 
      value: <Text>{humanReadableDate(file.created_at)}</Text>
    },
    ...(file.tags && file.tags.length > 0 ? [{ 
      icon: HiOutlineTag, 
      title: "Tags", 
      value: (
        <Flex wrap="wrap" gap={2}>
          {file.tags.map((tag) => (
            <Badge key={tag} colorScheme="cyan" mr={1}>
              {tag}
            </Badge>
          ))}
        </Flex>
      )
    }] : []),
    ...(file.is_group && file.children && file.children.length > 0 ? [{ 
      icon: HiOutlineFolder, 
      title: "Contents", 
      value: (
        <VStack align="stretch" spacing={1}>
          {file.children.map((child) => (
            <HStack key={child.id} justify="space-between">
              <Text 
                fontSize="sm" 
                as={Link}
                to={`/files/${child.id}?groupId=${file.id}`}
                _hover={{ color: "ui.main", textDecoration: "underline" }}
                cursor="pointer"
              >
                {child.name}
              </Text>
              <Badge size="sm">{child.file_type}</Badge>
            </HStack>
          ))}
        </VStack>
      )
    }] : [])
  ];

  return (
    <Flex direction={'column'}>
      {items.map(({ icon, title, value }) => (
        <HStack key={title} align={'top'} mb={3}>
          <Flex w={32} shrink={0} direction={'column'}>
            <Flex align={'center'}>
              <Icon as={icon} />
              <Text ml={2}>{title}</Text>
            </Flex>
          </Flex>
          <Flex align={'center'}>
            {value}
          </Flex>
        </HStack>
      ))}
    </Flex>
  );
}

function FileDetailContent() {
  const { fileId } = Route.useParams();
  const { groupId } = Route.useSearch();

  const { data: file } = useSuspenseQuery({
    ...readFileOptions({ path: { id: fileId } }),
  });

  const backLink = groupId ? `/files/${groupId}` : "/files";
  const backText = groupId ? "← Back to Group" : "← Back to My Files";

  return (
    <Box maxW={"5xl"} justifySelf={"center"} w={"full"} overflowX={"hidden"} px={2}>
      <Flex align={"center"} justify={'space-between'} gap={2}>
        <Flex
          as={Link}
          to={backLink}
          key={"Files"}
          _hover={{ color: "ui.main" }}
          fontWeight="semibold"
          align="center"
          whiteSpace={'nowrap'}
        >
          <Text>{backText}</Text>
        </Flex>
        <ButtonGroup size="sm">
          <DownloadFileButton file={file} size={"sm"} />
          <DeleteFileButton file={file} />
        </ButtonGroup>
      </Flex>
      
      <Flex
        direction="row"
        borderBottomWidth={1}
        alignItems={"start"}
        mb={2}
        mt={1}
      >
        <EditableFileName key={file.name} file={file} />
      </Flex>

      <Box my={4}>
        <FileMetadata file={file} />
      </Box>

      {!file.is_group && (
        <>
          <Heading size="md" mb={4}>
            Preview
          </Heading>
          <FileRenderer file={file} />
        </>
      )}

      {file.is_group && (
        <>
          <Heading size="md" mb={4} mt={6}>
            Group Contents
          </Heading>
          <Text color="gray.600" mb={4}>
            This is a file group containing {file.children?.length || 0} files.
          </Text>
        </>
      )}
    </Box>
  );
}

function FileDetailSkeleton() {
  return (
    <Container maxW="full">
      <Skeleton height="20px" mb={4} />
      <Skeleton height="40px" mb={4} />
      <Skeleton height="200px" />
    </Container>
  );
}

function FileDetail() {
  return (
    <Container maxW="full">
      <Suspense fallback={<FileDetailSkeleton />}>
        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Box>
              <Text color="red.500">Error: {error.message}</Text>
            </Box>
          )}
        >
          <FileDetailContent />
        </ErrorBoundary>
      </Suspense>
    </Container>
  );
}

export default FileDetail;
