import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/chakra-compat"
import { type FilePublic, FilesService } from "../../client"

interface UngroupButtonProps {
  file: FilePublic
  size?: "xs" | "sm" | "md" | "lg"
  onSuccess?: () => void
}

export default function UngroupButton({
  file,
  size = "sm",
  onSuccess,
}: UngroupButtonProps) {
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
    },
  })

  // Only show ungroup button for actual groups (not pairs)
  const isGroup = file.is_group
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
