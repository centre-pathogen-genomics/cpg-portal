import { Suspense } from 'react';
import { Skeleton, Image } from '@chakra-ui/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getDownloadTokenOptions } from '../../client/@tanstack/react-query.gen';

interface ImageFileProps {
  fileId: string;
}

const TextFile = ({ fileId }: ImageFileProps) => {
  // Fetch the text file content
  const { data: token } = useSuspenseQuery({
    ...getDownloadTokenOptions({ path: { id: fileId } }),
  });
  const url = `/api/v1/files/download/${token}`;
  return (
    <Suspense fallback={<Skeleton height="20px" />}>
      <Image src={url} alt="Image" fallback={<Skeleton height="20px" />} />
    </Suspense>
  );
};

export default TextFile;
