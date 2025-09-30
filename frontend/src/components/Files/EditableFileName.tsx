import { Editable, EditableInput, EditablePreview } from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { renameFileMutation } from "../../client/@tanstack/react-query.gen"
import useCustomToast from "../../hooks/useCustomToast"

interface EditableFileNameProps {
  file: any
}

const EditableFileName = ({ file }: EditableFileNameProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()

  const renameFile = useMutation({
    ...renameFileMutation(),
    onSuccess: () => {
      showToast("Success", "File renamed successfully.", "success")
      queryClient.invalidateQueries({ queryKey: ["files"] })
    },
    onError: (error: any) => {
      console.error("Failed to rename file:", error)
      const errorMessage = error?.response?.data?.detail || "An error occurred while renaming the file."
      showToast("Error", errorMessage, "error")
    },
  })

  return (
    <Editable
      defaultValue={file.name}
      isPreviewFocusable={true}
      selectAllOnFocus={true}
      onSubmit={(nextName) => {
        if (nextName !== file.name && nextName.trim() !== "") {
          renameFile.mutate({
            path: { id: file.id },
            query: { name: nextName.trim() }
          })
        }
      }}
    >
      <EditablePreview cursor="text" />
      <EditableInput />
    </Editable>
  )
}

export default EditableFileName
