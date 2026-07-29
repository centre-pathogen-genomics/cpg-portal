import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
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
      size={size === "xs" ? "sm" : size === "md" ? "default" : size}
      variant="outline"
      className="border-orange-500 text-orange-600 hover:text-orange-700"
      onClick={() => ungroupMutation.mutate()}
      disabled={ungroupMutation.isPending}
    >
      {ungroupMutation.isPending && <LoaderCircle className="animate-spin" />}
      Ungroup
    </Button>
  )
}
