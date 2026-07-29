import { useMutation, useQueryClient } from "@tanstack/react-query"

import { RunsService } from "../../client" // Ensure you have the RunsService correctly set up
import useCustomToast from "../../hooks/useCustomToast"
import { ConfirmationDialog } from "../Common/ConfirmationDialog"

interface CancelAllProps {
  isOpen: boolean
  onClose: () => void
}

const CancelAll = ({ isOpen, onClose }: CancelAllProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()

  const cancelRuns = async () => {
    await RunsService.cancelRuns() // Use the cancelRun method
  }

  const mutation = useMutation({
    mutationFn: cancelRuns,
    onSuccess: () => {
      showToast(
        "Success",
        "All running runs where cancelled successfully.",
        "success",
      )
      onClose()
    },
    onError: () => {
      showToast(
        "An error occurred.",
        "An error occurred while cancelling the runs.",
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
      title="Cancel All Running Runs"
      description="Are you sure you want to cancel all runs? This action cannot be undone."
      confirmLabel="Cancel All Runs"
      pending={mutation.isPending}
      onConfirm={() => mutation.mutate()}
    />
  )
}

export default CancelAll
