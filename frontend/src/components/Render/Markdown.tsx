import { Suspense } from 'react';
import { Skeleton, Flex } from '@chakra-ui/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { downloadFileOptions } from '../../client/@tanstack/react-query.gen';
import Markdown from 'react-markdown'
import React from 'react';

interface TextFileProps {
  fileId: string;
}

const TextFile = ({ fileId }: TextFileProps) => {
  // Fetch the text file content
  const { data: markdown } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  });

  return (
    <Suspense fallback={<Skeleton height="20px" />}>
        
      <Flex whiteSpace="pre-wrap" maxHeight="500px" overflowY="auto">
      <Markdown>{markdown as string}</Markdown>
      </Flex>
    </Suspense>
  );
};

export default TextFile;
