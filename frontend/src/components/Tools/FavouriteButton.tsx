import { useMutation } from "@tanstack/react-query"
import { HiHeart, HiOutlineHeart } from "react-icons/hi"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ToolMinimalPublic } from "../../client"
import {
  favouriteToolMutation,
  unfavouriteToolMutation,
} from "../../client/@tanstack/react-query.gen"

interface FavouriteButtonProps {
  tool: ToolMinimalPublic
  isFavourited: boolean
  setIsFavourited: (value: boolean) => void
  withCount?: boolean
  disabled?: boolean
}

function FavouriteButton({
  tool,
  isFavourited,
  setIsFavourited,
  withCount,
  disabled,
}: FavouriteButtonProps) {
  const favourite = useMutation({
    ...favouriteToolMutation(),
    onError: () => setIsFavourited(false),
    onSuccess: () => {
      setIsFavourited(true)
      tool.favourited = true
      if (tool.favourited_count !== undefined) tool.favourited_count += 1
    },
  })
  const unfavourite = useMutation({
    ...unfavouriteToolMutation(),
    onError: () => setIsFavourited(true),
    onSuccess: () => {
      setIsFavourited(false)
      tool.favourited = false
      if (tool.favourited_count !== undefined) tool.favourited_count -= 1
    },
  })
  const toggle = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (disabled) return
    const options = { path: { tool_id: tool.id } }
    isFavourited ? unfavourite.mutate(options) : favourite.mutate(options)
  }
  const icon = isFavourited ? <HiHeart /> : <HiOutlineHeart />
  return withCount ? (
    <button
      type="button"
      disabled={disabled}
      onClick={toggle}
      className={cn(
        "mr-2 flex items-center gap-0.5 hover:text-red-500",
        isFavourited && "text-red-500",
      )}
    >
      {icon}
      {tool.favourited_count || 0}
    </button>
  ) : (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      aria-label="Add to favorites"
      title="Add to favorites"
      onClick={toggle}
      className={cn(
        "rounded-full text-xl hover:text-red-500",
        isFavourited && "text-red-500",
      )}
    >
      {icon}
    </Button>
  )
}

export default FavouriteButton
