import {
  Box,
  Container,
  SimpleGrid,
  Skeleton,
  Text,
  Image,
  Flex,
  Select,
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { ToolsService, type ToolsOrderBy } from "../../client"
import ToolCard from "../../components/Tools/ToolCard"
import Logo from "/assets/images/cpg-logo.png"

export const Route = createFileRoute("/_layout/")({
  component: Tools,
})

function ToolCards({ orderBy }: { orderBy: ToolsOrderBy }) {
  const { data: tools } = useSuspenseQuery({
    queryKey: ["tools", orderBy], // Include orderBy in query key for caching
    queryFn: () => ToolsService.readTools({ orderBy }),
  })

  return (
    <>
      {tools.data.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </>
  )
}

function ToolsGrid({ orderBy }: { orderBy: ToolsOrderBy }) {
  return (
    <Suspense fallback={<Skeleton height="20px" />}>
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <Box>
            <Text>Error: {error.message}</Text>
          </Box>
        )}
      >
        <SimpleGrid minChildWidth='250px' spacing="20px">
          <ToolCards orderBy={orderBy} />
        </SimpleGrid>
      </ErrorBoundary>
    </Suspense>
  )
}

function Tools() {
  const [orderBy, setOrderBy] = useState<ToolsOrderBy>("run_count") // Default orderBy state

  const handleOrderByChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setOrderBy(event.target.value as ToolsOrderBy) // Update state when selection changes
  }

  return (
    <Container maxW="full">
      <Flex direction="column" align="center" my={8}>
        <Image
          src={Logo}
          alt="FastAPI logo"
          height="auto"
          maxW={{ base: "xs", md: "md" }} 
          alignSelf="center"
          mb={4}
          />
          <Text align='center' maxW={{ base: "100%", md: "3xl" }} fontSize={{base: 'lg', md: '2xl'}}>Explore and run tools from the most talented and accomplished scientists ready to take on your next project</Text>
      </Flex>
      <Flex justify="space-between" align="center" mb={4}>
        <Select w='200px' value={orderBy} onChange={handleOrderByChange}>
          <option value='run_count'>Popular</option>
          <option value='created_at'>New & Noteworthy</option>
        </Select>
      </Flex>
      <ToolsGrid orderBy={orderBy} />
    </Container>
  )
}
