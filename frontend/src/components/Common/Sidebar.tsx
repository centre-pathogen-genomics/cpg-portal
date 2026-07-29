import { Box, Flex, useColorModeValue } from "@/components/ui/chakra-compat"

import StorageStats from "../Files/StorageStats"
import SidebarItems from "./SidebarItems"

const Sidebar = () => {
  const bgColor = useColorModeValue("ui.light", "ui.dark")
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")

  return (
    <>
      {/* Desktop */}
      <Box bg={bgColor} h="100%" display={{ base: "none", md: "flex" }}>
        <Flex
          w="200px"
          flexDir="column"
          justify="space-between"
          bg={secBgColor}
          p={4}
          pt={2}
        >
          <Box>
            <SidebarItems />
          </Box>
          <StorageStats />
        </Flex>
      </Box>
    </>
  )
}

export default Sidebar
