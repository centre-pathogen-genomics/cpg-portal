import React from "react"
import { Button } from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FilesService, type FilePublic } from "../../client"

interface UngroupButtonProps {
  file: FilePublic
  size?: "xs" | "sm" | "md" | "lg"
  onSuccess?: () => void
}

export default function UngroupButton({ file, size = "sm", onSuccess }: UngroupButtonProps) {
  const queryClient = useQueryClient()

  const ungroupMutation = useMutation({
    mutationFn: () => FilesService.ungroupFile({ path: { id: file.id } }),
    onSuccess: () => {
      // Invalidate and refetch files query
      queryClient.invalidateQueries({ queryKey: ["files"] })
      onSuccess?.()
    },
    onError: (error) => {
      console.error("Failed to ungroup file:", error)
    }
  })

  const isGroup = file.file_type === "pair" || file.file_type === "group"
  const hasChildren = file.children && file.children.length > 0

  if (!isGroup || !hasChildren) {
    return null
  }

  return (
    <Button
      size={size}
      colorScheme="orange"
      variant="outline"
      onClick={() => ungroupMutation.mutate()}
      isLoading={ungroupMutation.isPending}
    >
      Ungroup
    </Button>
  )
}
