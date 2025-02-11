import { unfavouriteToolMutation, favouriteToolMutation } from "../../client/@tanstack/react-query.gen";
import { useMutation } from "@tanstack/react-query";
import type { ToolMinimalPublic } from "../../client";
import { Flex, IconButton, useColorModeValue } from "@chakra-ui/react";
import { HiHeart, HiOutlineHeart } from "react-icons/hi";


interface FavouriteButtonProps {
    tool: ToolMinimalPublic;
    isFavourited: boolean;
    setIsFavourited: (isFavourited: boolean) => void;
    withCount?: boolean;
    }

function FavouriteButton({ tool, isFavourited, setIsFavourited, withCount }: FavouriteButtonProps) {
    const colourMode = useColorModeValue("ui.light","ui.dark");
    const favouriteTool = useMutation({
        ...favouriteToolMutation(),
        onError: () => {
            setIsFavourited(true);
        },
        onSuccess: () => {
            setIsFavourited(true);
            tool.favourited = true;
            if (tool.favourited_count !== undefined) {
                tool.favourited_count = tool.favourited_count + 1;
            }
        },
    });

    const unfavouriteTool = useMutation({
        ...unfavouriteToolMutation(),
        onError: () => {
            setIsFavourited(false);
        },
        onSuccess: () => {
            setIsFavourited(false);
            tool.favourited = false;
            if (tool.favourited_count !== undefined) {
                tool.favourited_count = tool.favourited_count - 1;
            }
        },
    });

    return (withCount ? <Flex
        align="center"
        mr={2}
        _hover={{ color: "red.500" }}
        gap="0.5"
        color={isFavourited ? "red.500" : undefined}
        onClick={(e) => {
            e.stopPropagation();
            if (isFavourited) {
                unfavouriteTool.mutate({path: { tool_id: tool.id }});   
            } else {
                favouriteTool.mutate({path: { tool_id: tool.id }});
            }
          }
        }
      >
        {isFavourited ? <HiHeart /> : <HiOutlineHeart />}
        {tool.favourited_count ? tool.favourited_count : 0}
      </Flex> : <IconButton
                isRound={true}
                aria-label="Add to favorites"
                title="Add to favorites"
                bg={colourMode}
                fontSize="20px"
                _hover={{ color: "red" }}
                color={isFavourited ? "red.500" : undefined}
                icon={isFavourited ? <HiHeart /> : <HiOutlineHeart />}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isFavourited) {
                      unfavouriteTool.mutate({path: { tool_id: tool.id }});   
                  } else {
                      favouriteTool.mutate({path: { tool_id: tool.id }});
                  }
                }} // Opens the modal
            ></IconButton>
    )
}

export default FavouriteButton