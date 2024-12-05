import { Box, Container, Heading, Text } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { WorkflowsService } from "../../../client"
import RunWorkflowForm from "../../../components/Workflows/RunWorkflowForm"

export const Route = createFileRoute("/_layout/workflows/$name")({
  component: Workflow,
})

function Workflow() {
  const navigate = useNavigate()

  const { name } = Route.useParams()

  const { isError, data: workflow } = useQuery({
    queryKey: ["workflow", name],
    queryFn: () => WorkflowsService.readWorkflowByName({ workflowName: name }),
    retry: false,
  })

  if (isError || !workflow) {
    return (
      <Container maxW="lg">
        <Heading>Workflow Not Found</Heading>
        <Text>
          The requested workflow could not be found. Please check the ID and try
          again.
        </Text>
      </Container>
    )
  }

  return (
    <Box maxW="2xl" width="100%" mx={4} pt={12} pb={8}>
      <Heading size="lg">{workflow?.name}</Heading>
      <Text pb={4}>{workflow?.description}</Text>
      <RunWorkflowForm
        workflowId={workflow.id}
        onSuccess={(task) => {
          navigate({
            to: `/tasks/${task.id}`,
            params: { taskid: task.id },
            replace: false,
            resetScroll: true,
          })
        }}
      />
    </Box>
  )
}

export default Workflow
