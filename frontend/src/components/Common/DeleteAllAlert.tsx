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

import { RunsService, FilesService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface DeleteAllProps {
  type: "Runs" | "Files"
  isOpen: boolean
  onClose: () => void
}

const DeleteAll = ({ type, isOpen, onClose }: DeleteAllProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const ref = React.useRef<HTMLButtonElement | null>(null)
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm()

  const deleteEntities = async (type: string) => {
    if (type === "Runs") {
      (await RunsService.deleteRuns()).data
    } else if (type === "Files") {
      // Implement the deleteFiles method
      (await FilesService.deleteFiles()).data
    } else {
      throw new Error(`Unexpected type: ${type}`)
    }
  }

  const mutation = useMutation({
    mutationFn: deleteEntities,
    onSuccess: () => {
      showToast("Success", `All ${type.toLowerCase()} where deleted successfully.`, "success")
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
      console.log("onSettled")
      queryClient.invalidateQueries({
        queryKey: [`${type.toLowerCase()}`], // Invalidate queries related to runs
      })
    },
  })

  const onSubmit = async () => {
    mutation.mutate(type)
  }

  return (
    <>
      <AlertDialog
        isOpen={isOpen}
        onClose={onClose}
        leastDestructiveRef={ref}
        size={{ base: "sm", md: "md" }}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent as="form" onSubmit={handleSubmit(onSubmit)}>
            <AlertDialogHeader>{`Delete All ${type}`}</AlertDialogHeader>
            <AlertDialogBody>
              {`Are you sure you want to delete all ${type == "Runs" ? "(non-running) runs and associated files" : "files"}? This action cannot be undone.`}
            </AlertDialogBody>
            <AlertDialogFooter gap={3}>
              <Button variant="danger" type="submit" isLoading={isSubmitting}>
                Delete All {type}
              </Button>
              <Button
                ref={ref}
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

export default DeleteAll
