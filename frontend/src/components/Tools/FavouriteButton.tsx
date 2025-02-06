import { unfavouriteToolMutation, favouriteToolMutation } from "../../client/@tanstack/react-query.gen";
import { useMutation } from "@tanstack/react-query";
import type { ToolMinimalPublic } from "../../client";
import { IconButton } from "@chakra-ui/react";
import { HiHeart, HiOutlineHeart } from "react-icons/hi";


interface FavouriteButtonProps {
    tool: ToolMinimalPublic;
    isFavourited: boolean;
    setIsFavourited: (isFavourited: boolean) => void;
    }

function FavouriteButton({ tool, isFavourited, setIsFavourited }: FavouriteButtonProps) {
    
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

    return (<IconButton
                isRound={true}
                aria-label="Add to favorites"
                title="Add to favorites"
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