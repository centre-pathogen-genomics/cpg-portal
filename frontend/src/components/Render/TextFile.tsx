import { Suspense } from 'react';
import { Skeleton, Text } from '@chakra-ui/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { downloadFileOptions } from '../../client/@tanstack/react-query.gen';

interface TextFileProps {
  fileId: string;
}

const TextFile = ({ fileId }: TextFileProps) => {
  // Fetch the text file content
  const { data: textContent } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  });

  return (
    <Suspense fallback={<Skeleton height="20px" />}>
      <Text whiteSpace="pre-wrap" maxHeight="500px" overflowY="auto">
        {textContent as string}
      </Text>
    </Suspense>
  );
};

export default TextFile;
