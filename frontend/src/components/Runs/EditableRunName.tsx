import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { type RunPublicMinimal, RunsService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface EditRunNameProps {
  run: RunPublicMinimal
  editable?: boolean
}

const EditRunName = ({ run, editable = true }: EditRunNameProps) => {
  const initialName = run.name ?? run.id.split("-")[0]
  const [name, setName] = useState(initialName)
  const [editing, setEditing] = useState(false)
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const mutation = useMutation({
    mutationFn: (nextName: string) =>
      RunsService.renameRun({
        path: { id: run.id },
        query: { name: nextName },
      }),
    onError: () =>
      showToast(
        "An error occurred.",
        "An error occurred while renaming the run.",
        "error",
      ),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: [{ _id: "runsReadRun", path: { id: run.id } }],
      }),
  })

  const submit = () => {
    setEditing(false)
    const nextName = name.trim()
    if (nextName && nextName !== run.name) mutation.mutate(nextName)
    else setName(initialName)
  }

  if (editing && editable) {
    return (
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={submit}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit()
          if (event.key === "Escape") {
            setName(initialName)
            setEditing(false)
          }
        }}
        className="w-full bg-transparent text-2xl outline-none md:text-3xl lg:text-4xl"
      />
    )
  }

  return (
    <button
      type="button"
      disabled={!editable}
      onClick={() => setEditing(true)}
      className="w-auto text-left text-2xl disabled:cursor-default md:text-3xl lg:text-4xl"
    >
      {name}
    </button>
  )
}

export default EditRunName
