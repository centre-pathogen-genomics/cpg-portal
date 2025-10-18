import { Editable, EditableInput, EditablePreview } from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { renameFileMutation } from "../../client/@tanstack/react-query.gen"
import useCustomToast from "../../hooks/useCustomToast"

interface EditableFileNameProps {
  file: any
}

const EditableFileName = ({ file }: EditableFileNameProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [displayName, setDisplayName] = useState(file.name)

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
      // Revert to original name on error
      setDisplayName(file.name)
    },
  })

  return (
    <Editable
      key={file.name}
      value={displayName}
      fontSize={{ base: "2xl", md: "3xl", lg: "4xl" }}
      isPreviewFocusable={true}
      selectAllOnFocus={true}
      onChange={(value) => setDisplayName(value)}
      onSubmit={(nextName) => {
        if (nextName !== file.name && nextName.trim() !== "") {
          renameFile.mutate({
            path: { id: file.id },
            query: { name: nextName.trim() }
          })
        } else {
          setDisplayName(file.name)
        }
      }}
      onCancel={() => setDisplayName(file.name)}
      w={"full"}
    >
      <EditablePreview w={"auto"}  cursor="text" />
      <EditableInput />
    </Editable>
  )
}

export default EditableFileName
