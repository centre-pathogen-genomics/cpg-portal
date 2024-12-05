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

interface CancelAllProps {
  isOpen: boolean
  onClose: () => void
}

const CancelAll = ({ isOpen, onClose }: CancelAllProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const cancelRef = React.useRef<HTMLButtonElement | null>(null)
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm()

  const cancelTasks = async () => {
    await TasksService.cancelTasks() // Use the cancelTask method
  }

  const mutation = useMutation({
    mutationFn: cancelTasks,
    onSuccess: () => {
      showToast("Success", "All running tasks where cancelled successfully.", "success")
      onClose()
    },
    onError: () => {
      showToast(
        "An error occurred.",
        "An error occurred while cancelling the tasks.",
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
    mutation.mutate()
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
            <AlertDialogHeader>Cancel All Running Tasks</AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to cancel all tasks? This action cannot be
              undone.
            </AlertDialogBody>
            <AlertDialogFooter gap={3}>
              <Button variant="danger" type="submit" isLoading={isSubmitting}>
                Cancel All Tasks
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

export default CancelAll
