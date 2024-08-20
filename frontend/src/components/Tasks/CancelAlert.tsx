import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"

import { TasksService } from "../../client" // Ensure you have the TasksService correctly set up
import useCustomToast from "../../hooks/useCustomToast"

interface CancelProps {
  id: number
  isOpen: boolean
  onClose: () => void
}

const Cancel = ({ id, isOpen, onClose }: CancelProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const cancelRef = React.useRef<HTMLButtonElement | null>(null)
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm()

  const cancelTask = async (id: number) => {
    await TasksService.cancelTask({ id: id }) // Use the cancelTask method
  }

  const mutation = useMutation({
    mutationFn: cancelTask,
    onSuccess: () => {
      showToast("Success", "The task was cancelled successfully.", "success")
      onClose()
    },
    onError: () => {
      showToast(
        "An error occurred.",
        "An error occurred while cancelling the task.",
        "error",
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["tasks"], // Invalidate queries related to tasks
      })
    },
  })

  const onSubmit = async () => {
    mutation.mutate(id)
  }

  return (
    <>
      <AlertDialog
        isOpen={isOpen}
        onClose={onClose}
        leastDestructiveRef={cancelRef}
        size={{ base: "sm", md: "md" }}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent as="form" onSubmit={handleSubmit(onSubmit)}>
            <AlertDialogHeader>Cancel Task</AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to cancel this task? This action cannot be
              undone.
            </AlertDialogBody>
            <AlertDialogFooter gap={3}>
              <Button variant="danger" type="submit" isLoading={isSubmitting}>
                Cancel Task
              </Button>
              <Button
                ref={cancelRef}
                onClick={onClose}
                isDisabled={isSubmitting}
              >
                Close
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  )
}

export default Cancel
