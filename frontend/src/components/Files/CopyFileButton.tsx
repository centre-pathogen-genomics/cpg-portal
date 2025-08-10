import { Button, Tag, TagLabel, TagLeftIcon, Link, Spinner } from "@chakra-ui/react";
import { FaRegCopy } from "react-icons/fa";
import { HiCheckCircle } from "react-icons/hi";

import { useMutation } from "@tanstack/react-query";
import { copyFileMutation } from "../../client/@tanstack/react-query.gen";
import useCustomToast from "../../hooks/useCustomToast";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

interface CopyFileButtonProps {
  fileId: string;
  size?: "xs" | "sm" | "md" | "lg";
}

const CopyFileButton = ({ fileId, size = "md" }: CopyFileButtonProps) => {
  const showToast = useCustomToast();
  const [isCopied, setIsCopied] = useState(false);
  const navigate = useNavigate();

  const copyFile = useMutation({
    ...copyFileMutation({ path: { id: fileId } }),
    onSuccess: () => {
      setIsCopied(true);
      showToast("Success", "File copied to My Files successfully.", "success");
    },
    onError: () => {
      showToast("Error", "Failed to copy file to My Files.", "error");
    },
  });

  return (
    isCopied ? (
      <Tag cursor={"pointer"} colorScheme='green' size={size} p={1} >
        <TagLeftIcon size={size} as={HiCheckCircle} />
        <TagLabel as={'b'} fontSize={12} >
          Copied to <Link onClick={() => navigate({to: '/files'})}>My Files</Link>
        </TagLabel>
      </Tag>
    ) : (
      <Button
        variant="solid"
        size={size}
        leftIcon={copyFile.isPending ? undefined : <FaRegCopy />}
        onClick={() => copyFile.mutate({ path: { id: fileId } })}
        isLoading={copyFile.isPending}
        loadingText="Copying..."
        spinner={<Spinner size="sm" />}
        spinnerPlacement="start"
      >
        Copy to My Files
      </Button>
    )
  );
};

export default CopyFileButton;
