import {
  Box,
  Flex,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"

import type { UserPublic } from "../../client"
import useAuth from "../../hooks/useAuth"
import SidebarItems from "./SidebarItems"
import StorageStats from "../Files/StorageStats"


const Sidebar = () => {
  const queryClient = useQueryClient()
  const bgColor = useColorModeValue("ui.light", "ui.dark")
  const textColor = useColorModeValue("ui.dark", "ui.light")
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { logout } = useAuth()

  const handleLogout = async () => {
    logout()
  }

  return (
    <>
      

      {/* Desktop */}
      <Box
        bg={bgColor}
        h="100%"
        display={{ base: "none", md: "flex" }}
        
      >
        <Flex w="200px" flexDir="column" justify="space-between" bg={secBgColor} p={4} pt={2}>
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
