import React, { Suspense } from 'react';
import { 
    Flex,
  Skeleton, 
} from '@chakra-ui/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { FilesService } from '../../client';
import DownloadFileButton from '../Files/DownloadFileButton';
import CodeBlock from '../Common/CodeBlock';


interface JsonFileProps {
  fileId: string;
}

const JsonFile = ({ fileId }: JsonFileProps) => {
  // Use useSuspenseQuery to fetch the file
  const { data: jsonText } = useSuspenseQuery({
    queryKey: ["file", { id: fileId }],
    queryFn: () => FilesService.downloadFile({ id: fileId }),
  });
  // strinfy the json data
  const json = JSON.stringify(jsonText, null, 2);

  return (
    <Suspense fallback={<Skeleton height="20px" />}>
        <CodeBlock code={json as string} language="json" maxHeight='500px' />
        <Flex mt={4}>
            <DownloadFileButton fileId={fileId} />
        </Flex>
    </Suspense>
  );
};

export default JsonFile;
