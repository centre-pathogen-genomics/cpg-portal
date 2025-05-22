import { Suspense, useMemo } from 'react';
import { Skeleton, Image } from '@chakra-ui/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { downloadFileOptions } from '../../client/@tanstack/react-query.gen';

interface ImageFileProps {
  fileId: string;
}

const ImageFile = ({ fileId }: ImageFileProps) => {
  // Fetch binary image data as Blob
  const { data: blob } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } , responseType: 'blob' }),
  });

  // Convert blob to URL (memoized)
  const imageUrl = useMemo(() => {
    if (!blob) return '';
    return URL.createObjectURL(blob as Blob);
  }, [blob]);

  return (
    <Suspense fallback={<Skeleton height="200px" />}>
      <Image
        src={imageUrl}
        alt="Image"
        fallback={<Skeleton height="200px" />}
        objectFit="contain"
        maxH="500px"
      />
    </Suspense>
  );
};

export default ImageFile;
