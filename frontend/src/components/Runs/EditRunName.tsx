import { Editable, EditableInput, EditablePreview } from "@chakra-ui/react";
import { RunPublicMinimal, RunsService } from "../../client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import useCustomToast from "../../hooks/useCustomToast";

interface EditRunNameProps {
  run: RunPublicMinimal;
  editable?: boolean;
}

const EditRunName = ({ run, editable = true }: EditRunNameProps) => {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const renameRun = async (nextName: string) => {
    await RunsService.renameRun({ path: { id: run.id }, query: { name: nextName } });
  };
  const mutation = useMutation({
    mutationFn: renameRun,
    onError: () => {
      showToast(
        "An error occurred.",
        "An error occurred while renaming the run.",
        "error"
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [{ _id: "readRun", path: { id: run.id } }],
      });
    },
  });

  return (
    <Editable
      defaultValue={run.name ?? run.id.split("-")[0]}
      fontSize={{ base: "2xl", md: "3xl", lg: "4xl" }}
      isPreviewFocusable={editable}
      selectAllOnFocus={editable}
      isDisabled={!editable}
      onSubmit={(nextName) => {
        if (!editable) return;
        if (nextName !== run.name && nextName.trim() !== "") {
          mutation.mutate(nextName);
        }
      }}
      w={"full"}
    >
      {/* The preview will render as a Heading */}
      <EditablePreview w={"auto"} cursor={editable ? "text" : "default"} />
      {/* The input inherits Input props */}
      <EditableInput />
    </Editable>
  );
};

export default EditRunName;
