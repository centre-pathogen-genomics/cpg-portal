import {
  Box,
  Container,
  Heading,
  SimpleGrid,
  Skeleton,
  Text,
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { ToolsService } from "../../client"
import ToolCard from "../../components/Tools/ToolCard"

export const Route = createFileRoute("/_layout/")({
  component: Tools,
})

function ToolCards() {
  const { data: tools } = useSuspenseQuery({
    queryKey: ["tools"],
    queryFn: () => ToolsService.readTools({}),
  })

  return (
    <>
      {tools.data.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </>
  )
}

function ToolsGrid() {
  return (
    <Suspense fallback={<Skeleton height="20px" />}>
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <Box>
            <Text>Error: {error.message}</Text>
          </Box>
        )}
      >
        <SimpleGrid spacing="20px" mb={4}>
          <ToolCards />
        </SimpleGrid>
      </ErrorBoundary>
    </Suspense>
  )
}

function Tools() {
  return (
    <Container maxW="full">
      <Heading
        size="lg"
        textAlign={{ base: "center", md: "left" }}
        pt={12}
        pb={8}
      >
        CPG Tools
      </Heading>
      <ToolsGrid />
    </Container>
  )
}
