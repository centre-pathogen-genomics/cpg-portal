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
import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { ToolsService } from "../../client"
import ToolCard from "../../components/Tools/ToolCard"
import Logo from "/assets/images/cpg-logo.png"

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
        <SimpleGrid minChildWidth='250px' spacing="20px">
          <ToolCards />
        </SimpleGrid>
      </ErrorBoundary>
    </Suspense>
  )
}

function Tools() {
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
        <Select  w='200px'>
          <option value='option2'>Popular</option>
          <option value='option1'>New</option>
        </Select>
        {/* <Select  w='200px'>
          <option value='option2'>All</option>
          <option value='option1'>AMR</option>
          <option value='option3'>Torstiverse</option>
        </Select> */}

      </Flex>
      <ToolsGrid />
    </Container>
  )
}
