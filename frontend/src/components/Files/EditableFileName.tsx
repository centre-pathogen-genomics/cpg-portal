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
  const [editing, setEditing] = useState(false)
  const renameFile = useMutation({
    ...renameFileMutation(),
    onSuccess: () => {
      showToast("Success", "File renamed successfully.", "success")
      queryClient.invalidateQueries({ queryKey: ["files"] })
    },
    onError: (error: any) => {
      showToast(
        "Error",
        error?.response?.data?.detail ||
          "An error occurred while renaming the file.",
        "error",
      )
      setDisplayName(file.name)
    },
  })

  const submit = () => {
    setEditing(false)
    const name = displayName.trim()
    if (name && name !== file.name) {
      renameFile.mutate({ path: { id: file.id }, query: { name } })
    } else setDisplayName(file.name)
  }

  return editing ? (
    <input
      value={displayName}
      onChange={(event) => setDisplayName(event.target.value)}
      onBlur={submit}
      onKeyDown={(event) => {
        if (event.key === "Enter") submit()
        if (event.key === "Escape") {
          setDisplayName(file.name)
          setEditing(false)
        }
      }}
      className="w-full bg-transparent text-2xl outline-none md:text-3xl lg:text-4xl"
    />
  ) : (
    <button
      type="button"
      className="w-auto text-left text-2xl md:text-3xl lg:text-4xl"
      onClick={() => setEditing(true)}
    >
      {displayName}
    </button>
  )
}

export default EditableFileName
