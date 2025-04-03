import {
  Container,
  Text,
  Image,
  Flex,
} from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import Logo from "/assets/images/cpg-logo.png"
import ToolsGrid from "../../components/Tools/ToolsGrid"

export const Route = createFileRoute("/_layout/")({
  component: Tools,
})


function Tools() {
  return (
    <Container maxW="full" px={{ base: 4, md: 6, lg: 8, xl: 12 }}>
      <Flex direction="column" align="center" my={8} py={2} >
        <Image
          src={Logo}
          alt="CPG logo"
          height="auto"
          maxW={{ base: "xs", md: "md" }} 
          alignSelf="center"
          mb={4}
          />
          <Text align='center' maxW={{ base: "100%", md: "3xl" }} fontSize={{base: 'lg', md: '2xl'}}>Explore and run tools from the most talented and accomplished scientists ready to take on your next project</Text>
      </Flex>
      
      <ToolsGrid />
    </Container>
  )
}
