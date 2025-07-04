import {
  Container,
  Flex,
  Heading,
} from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import ToolsGrid from "../../../components/Tools/ToolsGrid"


export const Route = createFileRoute("/_layout/search/$query")({
  component: SearchResults,
  head: () => ({
    meta: [
      {
        title: "Search | CPG Portal",
      },
    ],
  }),
})


function SearchResults() {
  const { query } = Route.useParams()
  return (
    <Container maxW="full">
      <Flex direction="column" align="center" my={8}>
        <Heading>{query}</Heading>
      </Flex>
      <ToolsGrid search={query}/>
    </Container>
  )
}
