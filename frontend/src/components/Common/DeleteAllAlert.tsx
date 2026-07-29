import { useMutation, useQueryClient } from "@tanstack/react-query"

import { FilesService, RunsService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import { ConfirmationDialog } from "./ConfirmationDialog"

interface DeleteAllProps {
  type: "Runs" | "Files"
  isOpen: boolean
  onClose: () => void
}

const DeleteAll = ({ type, isOpen, onClose }: DeleteAllProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()

  const deleteEntities = async (type: string) => {
    if (type === "Runs") {
      ;(await RunsService.deleteRuns()).data
    } else if (type === "Files") {
      // Implement the deleteFiles method
      ;(await FilesService.deleteFiles()).data
    } else {
      throw new Error(`Unexpected type: ${type}`)
    }
  }

  const mutation = useMutation({
    mutationFn: deleteEntities,
    onSuccess: () => {
      showToast(
        "Success",
        `All ${type.toLowerCase()} where deleted successfully.`,
        "success",
      )
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
        queryKey: [`${type.toLowerCase()}`], // Invalidate queries related to runs
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
      title={`Delete All ${type}`}
      description={`Are you sure you want to delete all ${type === "Runs" ? "(non-running) runs and associated files" : "files"}? This action cannot be undone.`}
      confirmLabel={`Delete All ${type}`}
      pending={mutation.isPending}
      onConfirm={() => mutation.mutate(type)}
    />
  )
}

export default DeleteAll
