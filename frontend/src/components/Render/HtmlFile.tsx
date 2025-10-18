import { Suspense, useMemo, useEffect } from 'react';
import { Skeleton, Box } from '@chakra-ui/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { downloadFileOptions } from '../../client/@tanstack/react-query.gen';

interface HtmlFileProps {
  fileId: string;
}

const HtmlFile = ({ fileId }: HtmlFileProps) => {
  // Fetch the HTML file content
  const { data: htmlContent } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  });

  // Create a blob URL for the HTML content (memoized)
  const htmlUrl = useMemo(() => {
    if (!htmlContent) return '';
    const blob = new Blob([htmlContent as string], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [htmlContent]);

  // Clean up the blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (htmlUrl) {
        URL.revokeObjectURL(htmlUrl);
      }
    };
  }, [htmlUrl]);

  return (
    <Suspense fallback={<Skeleton height="400px" />}>
      <Box
        as="iframe"
        src={htmlUrl}
        width="100%"
        height="500px"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="md"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
        title="HTML Content"
      />
    </Suspense>
  );
};

export default HtmlFile;
