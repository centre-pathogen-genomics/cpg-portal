import { useMutation } from "@tanstack/react-query"
import { HiHeart, HiOutlineHeart } from "react-icons/hi"
import {
  Flex,
  IconButton,
  useColorModeValue,
} from "@/components/ui/chakra-compat"
import type { ToolMinimalPublic } from "../../client"
import {
  favouriteToolMutation,
  unfavouriteToolMutation,
} from "../../client/@tanstack/react-query.gen"

interface FavouriteButtonProps {
  tool: ToolMinimalPublic
  isFavourited: boolean
  setIsFavourited: (isFavourited: boolean) => void
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
  const colourMode = useColorModeValue("ui.light", "ui.dark")
  const favouriteTool = useMutation({
    ...favouriteToolMutation(),
    onError: () => {
      setIsFavourited(true)
    },
    onSuccess: () => {
      setIsFavourited(true)
      tool.favourited = true
      if (tool.favourited_count !== undefined) {
        tool.favourited_count = tool.favourited_count + 1
      }
    },
  })

  const unfavouriteTool = useMutation({
    ...unfavouriteToolMutation(),
    onError: () => {
      setIsFavourited(false)
    },
    onSuccess: () => {
      setIsFavourited(false)
      tool.favourited = false
      if (tool.favourited_count !== undefined) {
        tool.favourited_count = tool.favourited_count - 1
      }
    },
  })

  return withCount ? (
    <Flex
      align="center"
      mr={2}
      _hover={{ color: "red.500" }}
      gap="0.5"
      color={isFavourited ? "red.500" : undefined}
      onClick={(e) => {
        e.stopPropagation()
        if (disabled) return // Prevent action if disabled
        if (isFavourited) {
          unfavouriteTool.mutate({ path: { tool_id: tool.id } })
        } else {
          favouriteTool.mutate({ path: { tool_id: tool.id } })
        }
      }}
    >
      {isFavourited ? <HiHeart /> : <HiOutlineHeart />}
      {tool.favourited_count ? tool.favourited_count : 0}
    </Flex>
  ) : (
    <IconButton
      isRound={true}
      aria-label="Add to favorites"
      title="Add to favorites"
      bg={colourMode}
      fontSize="20px"
      _hover={{ color: "red" }}
      color={isFavourited ? "red.500" : undefined}
      icon={isFavourited ? <HiHeart /> : <HiOutlineHeart />}
      onClick={(e) => {
        e.stopPropagation()
        if (disabled) return // Prevent action if disabled
        if (isFavourited) {
          unfavouriteTool.mutate({ path: { tool_id: tool.id } })
        } else {
          favouriteTool.mutate({ path: { tool_id: tool.id } })
        }
      }} // Opens the modal
    />
  )
}

export default FavouriteButton
