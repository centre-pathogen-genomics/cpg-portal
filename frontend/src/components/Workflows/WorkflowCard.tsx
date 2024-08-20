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
import type { WorkflowPublic } from "../../client"
import RunWorkflowModal from "./RunWorkflowModal" // Adjust the import path as needed

interface WorkflowCardProps {
  workflow: WorkflowPublic
}

const WorkflowCard = ({ workflow }: WorkflowCardProps) => {
  const runWorkflowModal = useDisclosure()
  const navigate = useNavigate()
  return (
    <>
      <Card
        variant="outline"
        direction={{ base: "column", sm: "row" }}
        overflow="hidden"
      >
        <Image
          objectFit="cover"
          maxW={{ base: "100%", sm: "200px" }}
          src={
            workflow.image != null
              ? workflow.image
              : "https://images.unsplash.com/photo-1543145499-8193615267de?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHw5fHx8ZW58MHx8fHw%3D&auto=format&fit=crop&w=800&q=60"
          }
          // src='https://images.unsplash.com/photo-1543145499-8193615267de?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHw5fHx8ZW58MHx8fHw%3D&auto=format&fit=crop&w=800&q=60'
          alt="Caffe Latte"
        />
        <Stack>
          <CardHeader>
            <Heading size="lg">{workflow.name}</Heading>
          </CardHeader>
          <CardBody>
            <Text>{workflow.description}</Text>
          </CardBody>
          <CardFooter>
            <ButtonGroup spacing={4}>
              <Button
                variant="primary"
                leftIcon={<FaPlay />}
                onClick={runWorkflowModal.onOpen} // Opens the modal
              >
                Run
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  navigate({
                    to: `/workflows/${workflow.id.toString()}`,
                    params: { workflowid: workflow.id.toString() },
                    replace: false,
                    resetScroll: true,
                  })
                }}
                leftIcon={<ViewIcon />}
              >
                View
              </Button>
            </ButtonGroup>
          </CardFooter>
        </Stack>
      </Card>
      <RunWorkflowModal
        isOpen={runWorkflowModal.isOpen}
        onClose={runWorkflowModal.onClose}
        workflowId={workflow.id}
      />
    </>
  )
}

export default WorkflowCard
