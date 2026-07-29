import { useMutation, useQueryClient } from "@tanstack/react-query"

import { FilesService, RunsService, UsersService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import { ConfirmationDialog } from "./ConfirmationDialog"

interface DeleteProps {
  type: string
  id: string
  isOpen: boolean
  onClose: () => void
  onDelete?: () => void
}

const Delete = ({ type, id, isOpen, onClose, onDelete }: DeleteProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()

  const deleteEntity = async (id: string) => {
    if (type === "User") {
      await UsersService.deleteUser({ path: { user_id: id } })
    } else if (type === "Run") {
      await RunsService.deleteRun({ path: { id: id } })
    } else if (type === "File") {
      await FilesService.deleteFile({ path: { id: id } })
    } else {
      throw new Error(`Unexpected type: ${type}`)
    }
  }

  const mutation = useMutation({
    mutationFn: deleteEntity,
    onSuccess: () => {
      showToast(
        "Success",
        `The ${type.toLowerCase()} was deleted successfully.`,
        "success",
      )
      onDelete?.()
      onClose()
    },
    onError: () => {
      showToast(
        "An error occurred.",
        `An error occurred while deleting the ${type.toLowerCase()}.`,
        "error",
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [`${type.toLowerCase()}s`],
      })
      queryClient.invalidateQueries({
        queryKey: [{ _id: "getFilesStats" }],
      })
    },
  })

  return (
    <ConfirmationDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={`Delete ${type} (${id})`}
      description={
        <>
          {type === "User" && (
            <span>
              All items associated with this user will also be{" "}
              <strong>permanently deleted. </strong>
            </span>
          )}
          Are you sure? You will not be able to undo this action.
        </>
      }
      confirmLabel="Delete"
      pending={mutation.isPending}
      onConfirm={() => mutation.mutate(id)}
    />
  )
}

export default Delete
