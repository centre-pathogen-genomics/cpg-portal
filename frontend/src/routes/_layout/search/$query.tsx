import {
  Container,
  Flex,
  Heading,
} from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import ToolsGrid from "../../../components/Tools/ToolsGrid"


export const Route = createFileRoute("/_layout/search/$query")({
  component: SearchResults,
})


function SearchResults() {
  const { query } = Route.useParams()
  console.log(query)
  return (
    <Container maxW="full">
      <Flex direction="column" align="center" my={8}>
        <Heading>{query}</Heading>
      </Flex>
      <ToolsGrid search={query}/>
    </Container>
  )
}
