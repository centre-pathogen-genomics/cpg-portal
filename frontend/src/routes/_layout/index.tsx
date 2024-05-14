import { Box, Container, Text, Skeleton, SimpleGrid, Heading } from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { WorkflowsService} from "../../client"
import WorkflowCard from "../../components/Workflows/WorkflowCard"


export const Route = createFileRoute("/_layout/")({
  component: Workflows,
})

function WorkflowCards() {

  const { data: workflows } = useSuspenseQuery({
    queryKey: ["workflows"],
    queryFn: () => WorkflowsService.readWorkflows({}),
  })

  return (
    <>
      
      {workflows.data.map((workflow) => (
        <WorkflowCard key={workflow.id} workflow={workflow} />
      ))}
      
    </>
  )
}


function WorkflowsGrid() {
  return (
      <Suspense fallback={<Skeleton height="20px" />}>
        <ErrorBoundary fallbackRender={
          ({ error }) => (
            <Box>
              <Text>Error: {error.message}</Text>
            </Box>
          )
        }>
          <SimpleGrid minChildWidth='250px' spacing='20px'>
            <WorkflowCards />
          </SimpleGrid>
        </ErrorBoundary>
      </Suspense>
  )
}


function Workflows() {
  return (
    <Container maxW="full">
    <Heading size="lg" textAlign={{ base: "center", md: "left" }} pt={12} pb={8}>
      CPG Workflows
    </Heading>
    <WorkflowsGrid />
  </Container>
  )
}