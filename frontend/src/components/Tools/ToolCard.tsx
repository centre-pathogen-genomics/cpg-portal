import {
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Heading,
  Image,
  Stack,
  Text,
} from "@chakra-ui/react"
import { useDisclosure } from "@chakra-ui/react"
import { FaPlay } from "react-icons/fa"

import { ViewIcon } from "@chakra-ui/icons"
import { useNavigate } from "@tanstack/react-router"
import type { ToolPublic } from "../../client"
import RunToolModal from "./RunToolModal" // Adjust the import path as needed

interface ToolCardProps {
  tool: ToolPublic
}

const ToolCard = ({ tool }: ToolCardProps) => {
  const runToolModal = useDisclosure()
  const navigate = useNavigate()

  const navigateToTool = () => {
    navigate({
      to: `/tools/${tool.name}`,
      params: { name: tool.name },
      replace: false,
      resetScroll: true,
    })
  }
  return (
    <>
      <Card
        variant="elevated"
        overflow="hidden"
        maxW={{ base: "100%", md: "400px" }}
        size={"sm"}
        // on unhover return to normal state
        _hover={{
          boxShadow: "xl",
          transform: "translateY(-2px)",
          transition: "all 0.2s",
        }}
        cursor={"pointer"}
        onClick={navigateToTool}
        
      >
        <Image
          objectFit="cover"
          maxH={{ base: "200px" }}
          src={
            tool.image != null
              ? tool.image
              : "https://images.unsplash.com/photo-1543145499-8193615267de?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHw5fHx8ZW58MHx8fHw%3D&auto=format&fit=crop&w=800&q=60"
          }
          // src='https://images.unsplash.com/photo-1543145499-8193615267de?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHw5fHx8ZW58MHx8fHw%3D&auto=format&fit=crop&w=800&q=60'
          alt="Caffe Latte"
        />
          <CardHeader>
            <Heading size="lg">{tool.name}</Heading>
          </CardHeader>
          <CardBody>
            <Text>{tool.description}</Text>
          </CardBody>
          <CardFooter >
            <ButtonGroup spacing={4} onClick={(e) => e.stopPropagation()}>
              <Button
                variant="primary"
                leftIcon={<FaPlay />}
                onClick={runToolModal.onOpen} // Opens the modal
              >
                Run
              </Button>
              {/* <Button
                variant="outline"
                onClick={() => {
                  navigate({
                    to: `/tools/${tool.name}`,
                    params: { name: tool.name },
                    replace: false,
                    resetScroll: true,
                  })
                }}
                leftIcon={<ViewIcon />}
              >
                View
              </Button> */}
            </ButtonGroup>
          </CardFooter>
      </Card>
      <RunToolModal
        isOpen={runToolModal.isOpen}
        onClose={runToolModal.onClose}
        toolId={tool.id}
      />
    </>
  )
}

export default ToolCard
