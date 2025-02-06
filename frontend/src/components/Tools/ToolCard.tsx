import {
  ButtonGroup,
  IconButton,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Heading,
  Image,
  Text,
  Flex,
  Tag,
} from "@chakra-ui/react";
import { useDisclosure } from "@chakra-ui/react";
import { HiOutlinePlay, HiOutlineHeart, HiHeart } from "react-icons/hi2";
import { useNavigate } from "@tanstack/react-router";


import type { ToolMinimalPublic } from "../../client";
import RunToolModal from "./RunToolModal"; // Adjust the import path as needed
import FavouriteButton from "./FavouriteButton";
import '../../assets/css/App.css';
import { useState } from "react";

interface ToolCardProps {
  tool: ToolMinimalPublic;
}

const ToolCard = ({ tool }: ToolCardProps) => {
  const runToolModal = useDisclosure();
  const navigate = useNavigate();
  
  const [isFavourited, setIsFavourited] = useState(tool.favourited ?? false); 
  

  const navigateToTool = () => {
    navigate({
      to: `/tools/${tool.name}`,
      params: { name: tool.name },
      replace: false,
      resetScroll: true,
    });
  };
  return (
    <>
      <Card
        variant="elevated"
        overflow="hidden"
        maxW={{ base: "100%", lg: "400px" }}
        size={"md"}
        // on unhover return to normal state
        _hover={{
          boxShadow: "xl",
          transform: "translateY(-2px)",
          transition: "all 0.2s",
        }}
        cursor={"pointer"}
        onClick={navigateToTool}
        className="group"
      >
        <Flex
          justify="center"
          align="center"
          h={{ base: "120px"}}
          overflow="hidden"
          position="relative"
        >
          <Image
            objectFit='cover'
            h={"100%"}
            w={"100%"}
            src={
              tool.image != null
                ? tool.image
                : "https://images.unsplash.com/photo-1543145499-8193615267de?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHw5fHx8ZW58MHx8fHw%3D&auto=format&fit=crop&w=800&q=60"
            }
            // src='https://images.unsplash.com/photo-1543145499-8193615267de?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHw5fHx8ZW58MHx8fHw%3D&auto=format&fit=crop&w=800&q=60'
            alt="Caffe Latte"
            _groupHover={{ filter: "brightness(1.2)" }}
          />
          <Flex
            _groupHover={{ display: "block" }}
            position="absolute"
            h="100%"
            w="100%"
            display="none"
            p={2}
          >
            <ButtonGroup justifyContent={"end"} w="100%">
              <FavouriteButton tool={tool} isFavourited={isFavourited} setIsFavourited={setIsFavourited} />
              <IconButton
                isRound={true}
                variant="solid"
                aria-label="Run"
                title="Run tool"
                mr="2"
                fontSize="20px"
                _hover={{ color: "green" }}
                icon={<HiOutlinePlay />}
                onClick={(e) => {
                  e.stopPropagation();
                  runToolModal.onOpen();
                }} // Opens the modal
              ></IconButton>
            </ButtonGroup>
          </Flex>
        </Flex>

        <CardHeader pb={0}>
          <Heading  size="lg">
            {tool.name}
          </Heading>
        </CardHeader>
        <CardBody>
          <Text noOfLines={3}>{tool.description}</Text>
        </CardBody>
        <CardFooter justify="space-between">
          <Flex overflow={"auto"} wrap={"nowrap"} mr={2} className="no-scroll">
            {tool.tags?.map((tag) => (
              <Tag size="sm" key={tag} mr={1} whiteSpace={"nowrap"} flexShrink={0}>
                {tag}
              </Tag>
            ))}
          </Flex>
          <Flex color="gray.500">
            <Flex
              align="center"
              mr={2}
              _hover={{ color: "red.500" }}
              gap="0.5"
              color={isFavourited ? "red.500" : undefined}
            >
              {isFavourited ? <HiHeart /> : <HiOutlineHeart />}
              {tool.favourited_count ? tool.favourited_count : 0}
            </Flex>
            <Flex align="center" justify="center" gap="0.5">
              <HiOutlinePlay />
              {tool.run_count ? tool.run_count : 0}
            </Flex>
          </Flex>
        </CardFooter>
      </Card>
      <RunToolModal
        isOpen={runToolModal.isOpen}
        onClose={runToolModal.onClose}
        toolId={tool.id}
        params={tool.params ? tool.params : []}
      />
    </>
  );
};

export default ToolCard;
