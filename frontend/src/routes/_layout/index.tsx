import {
  Container,
  Text,
  Image,
  Flex,
  Button
} from "@chakra-ui/react"
import { createFileRoute, Link } from "@tanstack/react-router"
import Logo from "/assets/images/cpg-logo.png"
import ToolsGrid from "../../components/Tools/ToolsGrid"
import useAuth from "../../hooks/useAuth"

export const Route = createFileRoute("/_layout/")({
  component: Tools,
})


function Tools() {
  const { user: currentUser } = useAuth()

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
        {!currentUser && (
          <Flex mt={4} justify="center" gap={4}>
            <Button as={Link} to="/signup" colorScheme="teal" variant="solid">
              Sign Up
            </Button>
            <Button as={Link} to="/about"  variant="link">
              Learn More
            </Button>
          </Flex>
        )}
      </Flex>
      
      <ToolsGrid hideFilters={currentUser === undefined}/>
    </Container>
  )
}
