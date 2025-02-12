import {
    Box,
    SimpleGrid,
    Skeleton,
    Text,
    Flex,
    Select,
    Switch,
    FormLabel,
    Heading,
    Image,
} from "@chakra-ui/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { type ToolsOrderBy } from "../../client"
import { readToolsOptions } from "../../client/@tanstack/react-query.gen"
import ToolCard from "../../components/Tools/ToolCard"
import React from "react"
import ErrorLogo from "/assets/images/500.png"
  
function ToolCards({ orderBy, showFavourites, search }: { orderBy: ToolsOrderBy, showFavourites: boolean, search?: string }) {
const { data: tools } = useSuspenseQuery({
    ...readToolsOptions({ query: { order_by: orderBy, show_favourites: showFavourites, search: search } }),
})

return (
    <>
    {tools?.data.length === 0 && (
        <Flex justify="center" align="center" h="200px">
            <Heading size={'md'}>No matches found</Heading>
        </Flex>
    )}
    <SimpleGrid gap={4} mb={8} gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))" >
        {tools.data.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
        ))}
    </SimpleGrid>
    </>
)
}

function ToolsGrid({ search }: { search?: string }) {
const [orderBy, setOrderBy] = useState<ToolsOrderBy>("run_count") // Default orderBy state
const [showFavourites, setShowFavourites] = useState(false)

const handleOrderByChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setOrderBy(event.target.value as ToolsOrderBy) // Update state when selection changes
}


return (
    <Suspense fallback={<Skeleton height="20px" />}>
    <ErrorBoundary
        fallbackRender={() => (
        <Box textAlign="center" mt={8} w={'100%'} justifyContent={'center'} alignItems={'center'}>
            <Text>Something went wrong... Please reload the page!</Text>
            <Image src={ErrorLogo} alt="Error" />
        </Box>
        )}
    >
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
        <ToolCards orderBy={orderBy} showFavourites={showFavourites} search={search} />
    </ErrorBoundary>
    </Suspense>
)
}

export default ToolsGrid