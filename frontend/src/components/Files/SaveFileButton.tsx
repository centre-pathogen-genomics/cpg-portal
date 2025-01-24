import { Button, Tag, TagLabel, TagLeftIcon, Link } from "@chakra-ui/react";
import { FaRegSave } from "react-icons/fa";
import { HiCheckCircle } from "react-icons/hi";

import { useMutation } from "@tanstack/react-query";
import { saveFileMutation } from "../../client/@tanstack/react-query.gen";
import useCustomToast from "../../hooks/useCustomToast";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

interface SaveFileButtonProps {
  fileId: string;
  saved: boolean;
  size?: "sm" | "md" | "lg";
}

const SaveFileButton = ({ fileId, saved, size }: SaveFileButtonProps) => {
  const showToast = useCustomToast();
  const [isSaved, setIsSaved] = useState(saved);
  const navigate = useNavigate();

  const saveFile = useMutation({
    ...saveFileMutation({ path: { id: fileId } }),
    onSuccess: () => {
      showToast("Success", "File saved successfully.", "success");
    },
    onError: () => {
      showToast("Error", "An error occurred while saving the file.", "error");
    },
  });

  return (
    isSaved ? (
      <Tag cursor={"pointer"} colorScheme='green' size={"lg"} >
        <TagLeftIcon size={'lg'} as={HiCheckCircle} />
        <TagLabel >Saved to <Link onClick={() => navigate({to: '/files'})}>My Files</Link></TagLabel>
      </Tag>
    ) : (
      <Button
        color="ui.main"
        variant="solid"
        size={size}
        leftIcon={<FaRegSave />}
        onClick={() => {saveFile.mutate({ path: { id: fileId } }); setIsSaved(true)} }
      >
        Save to My Files
      </Button>
    )
  );
};

export default SaveFileButton;
