import { Suspense } from 'react';
import { 
  Skeleton, 
} from '@chakra-ui/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import CodeBlock from '../Common/CodeBlock';
import { downloadFileOptions } from '../../client/@tanstack/react-query.gen';


interface JsonFileProps {
  fileId: string;
}

const JsonFile = ({ fileId }: JsonFileProps) => {
  // Use useSuspenseQuery to fetch the file
  const { data: jsonText } = useSuspenseQuery({
    ...downloadFileOptions({path: { id: fileId }}),
  });
  // strinfy the json data
  const json = JSON.stringify(jsonText, null, 2);

  return (
    <Suspense fallback={<Skeleton height="20px" />}>
        <CodeBlock code={json as string} language="json" maxHeight='500px' />
    </Suspense>
  );
};

export default JsonFile;
