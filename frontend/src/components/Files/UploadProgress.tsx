// components/UploadProgress.tsx
import React from "react";
import { Progress, Box } from "@chakra-ui/react";
import { useUpload } from "../../context/UploadContext";

const UploadProgress: React.FC = () => {
  const { isUploading, progress } = useUpload();

  if (!isUploading) return null;

  return (
    <Box position="fixed" bottom="0" left="0" width="100%" zIndex="1000">
      <Progress value={progress} colorScheme="blue" />
    </Box>
  );
};

export default UploadProgress;
