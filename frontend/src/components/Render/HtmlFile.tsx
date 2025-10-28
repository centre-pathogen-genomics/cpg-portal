import { Box } from '@chakra-ui/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { downloadFileOptions } from '../../client/@tanstack/react-query.gen';

interface HtmlFileProps {
  fileId: string;
  height?: string | number;
}

const HtmlFile = ({ fileId, height = 500 }: HtmlFileProps) => {
  const { data: htmlContent } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  });

  // Ensure string (server might return ArrayBuffer/Uint8Array)
  const html = typeof htmlContent === 'string'
    ? htmlContent
    : new TextDecoder().decode(htmlContent as ArrayBuffer);

  return (
    <Box
      as="iframe"
      title="Untrusted HTML"
      // DO NOT include allow-same-origin
      sandbox="allow-scripts allow-forms allow-modals allow-popups-by-user-activation"
      // Prevent cookies/referrers from leaking on subrequests
      referrerPolicy="no-referrer"
      // Permissions-Policy for this frame (modern 'allow' attribute)
      allow="
        geolocation 'none'; microphone 'none'; camera 'none'; payment 'none';
        usb 'none'; xr-spatial-tracking 'none'; clipboard-read *; clipboard-write *
      "
      // Feed the user HTML directly; no same-origin blob URL
      srcDoc={html}
      width="100%"
      height={height}
      border="1px solid"
      borderColor="gray.200"
      borderRadius="md"
    />
  );
};

export default HtmlFile;
