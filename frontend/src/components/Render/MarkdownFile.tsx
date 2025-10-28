import { Flex } from '@chakra-ui/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { downloadFileOptions } from '../../client/@tanstack/react-query.gen';
import Markdown from '../Common/Markdown';

interface MarkdownFileProps {
  fileId: string;
}

const MarkdownFile = ({ fileId }: MarkdownFileProps) => {
  // Fetch the text file content
  const { data: markdown } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  });

  return (
    <Flex whiteSpace="pre-wrap" maxHeight="500px" overflowY="auto">
       <Markdown markdown={markdown as string} />
    </Flex>
  );
};

export default MarkdownFile;
