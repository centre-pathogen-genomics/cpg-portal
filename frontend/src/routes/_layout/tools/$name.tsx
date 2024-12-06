import { Box, Container, Heading, Text } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ToolsService } from "../../../client"
import RunToolForm from "../../../components/Tools/RunToolForm"

export const Route = createFileRoute("/_layout/tools/$name")({
  component: Tool,
})

function Tool() {
  const navigate = useNavigate()

  const { name } = Route.useParams()

  const { isError, data: tool } = useQuery({
    queryKey: ["tool", name],
    queryFn: () => ToolsService.readToolByName({ toolName: name }),
    retry: false,
  })

  if (isError || !tool) {
    return (
      <Container maxW="lg">
        <Heading>Tool Not Found</Heading>
        <Text>
          The requested tool could not be found. Please check the ID and try
          again.
        </Text>
      </Container>
    )
  }

  return (
    <Box maxW="2xl" width="100%" mx={4} pt={12} pb={8}>
      <Heading size="lg">{tool?.name}</Heading>
      <Text pb={4}>{tool?.description}</Text>
      <RunToolForm
        toolId={tool.id}
        onSuccess={(run) => {
          navigate({
            to: `/runs/${run.id}`,
            params: { runid: run.id },
            replace: false,
            resetScroll: true,
          })
        }}
      />
    </Box>
  )
}

export default Tool
