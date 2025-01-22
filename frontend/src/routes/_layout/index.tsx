import {
  Box,
  Container,
  SimpleGrid,
  Skeleton,
  Text,
  Image,
  Flex,
  Select,
  Switch,
  FormLabel,
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { type ToolsOrderBy } from "../../client"
import { readToolsOptions } from "../../client/@tanstack/react-query.gen"
import ToolCard from "../../components/Tools/ToolCard"
import Logo from "/assets/images/cpg-logo.png"

export const Route = createFileRoute("/_layout/")({
  component: Tools,
})

function ToolCards({ orderBy, showFavourites }: { orderBy: ToolsOrderBy, showFavourites: boolean }) {
  const { data: tools } = useSuspenseQuery({
    ...readToolsOptions({ query: { order_by: orderBy, show_favourites: showFavourites } }),
  })

  return (
    <>
      {tools.data.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </>
  )
}

function ToolsGrid({ orderBy, showFavourites }: { orderBy: ToolsOrderBy, showFavourites: boolean }) {
  return (
    <Suspense fallback={<Skeleton height="20px" />}>
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <Box>
            <Text>Error: {error.message}</Text>
          </Box>
        )}
      >
        <SimpleGrid minChildWidth='250px' spacing="20px" mb={8}>
          <ToolCards orderBy={orderBy} showFavourites={showFavourites} />
        </SimpleGrid>
      </ErrorBoundary>
    </Suspense>
  )
}

function Tools() {
  const [orderBy, setOrderBy] = useState<ToolsOrderBy>("run_count") // Default orderBy state
  const [showFavourites, setShowFavourites] = useState(false)

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
      <Flex justify="space-between" align={"end"}   mb={4}>
        <Select w='200px' value={orderBy} onChange={handleOrderByChange}>
          <option value='run_count'>Popular</option>
          <option value='created_at'>New & Noteworthy</option>
        </Select>
        {/* <Tooltip placement='top' hasArrow label='Show favourites'> */}
        <Flex align='center'>
        <FormLabel htmlFor='show-favourites' mb='0' mr={1}>
          Favourites
        </FormLabel>
        <Switch size='md' id="show-favourites" isChecked={showFavourites} onChange={() => setShowFavourites(!showFavourites)} />
        {/* </Tooltip> */}
        </Flex>
      </Flex>
      <ToolsGrid orderBy={orderBy} showFavourites={showFavourites} />
    </Container>
  )
}
