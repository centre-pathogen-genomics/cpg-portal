import { useMutation, useQueryClient } from "@tanstack/react-query"

import { RunsService } from "../../client" // Ensure you have the RunsService correctly set up
import useCustomToast from "../../hooks/useCustomToast"
import { ConfirmationDialog } from "../Common/ConfirmationDialog"

interface CancelProps {
  id: string
  isOpen: boolean
  onClose: () => void
}

const Cancel = ({ id, isOpen, onClose }: CancelProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()

  const cancelRun = async (id: string) => {
    await RunsService.cancelRun({ path: { id } }) // Use the cancelRun method
  }

  const mutation = useMutation({
    mutationFn: cancelRun,
    onSuccess: () => {
      showToast("Success", "The run was cancelled successfully.", "success")
      onClose()
    },
    onError: () => {
      showToast(
        "An error occurred.",
        "An error occurred while cancelling the run.",
        "error",
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["runs"], // Invalidate queries related to runs
      })
    },
  })

  return (
    <ConfirmationDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Cancel Run"
      description="Are you sure you want to cancel this run? This action cannot be undone."
      confirmLabel="Cancel Run"
      pending={mutation.isPending}
      onConfirm={() => mutation.mutate(id)}
    />
  )
}

export default Cancel
