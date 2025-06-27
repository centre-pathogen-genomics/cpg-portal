import { Box, Flex, Icon, Text, useColorModeValue } from "@chakra-ui/react"
import { Link } from "@tanstack/react-router"
import { FiCodesandbox, FiFile, FiHome, FiInfo, FiLogIn, FiLogOut, FiSettings, FiUsers } from "react-icons/fi"
import { IoGlasses } from "react-icons/io5";

import useAuth from "../../hooks/useAuth"
import StorageStats from "../Files/StorageStats"

interface SidebarItemsProps {
  onClose?: () => void
}

const SidebarItems = ({ onClose }: SidebarItemsProps) => {
  const textColor = useColorModeValue("ui.main", "ui.light")
  const { logout, user: currentUser } = useAuth()

  const userItems = currentUser ? [
    { icon: FiHome, title: "Tools", path: "/" },
    { icon: FiCodesandbox, title: "My Runs", path: "/runs" },
    { icon: FiFile, title: "My Files", path: "/files" },
    { icon: FiInfo, title: "About", path: "/about" },
    { icon: FiSettings, title: "Settings", path: "/settings" },
    { icon: IoGlasses, title: "Stream", path: "/stream", external: true },
  ] : [
      { icon: FiHome, title: "Tools", path: "/" },
      { icon: FiInfo, title: "About", path: "/about" },
      { icon: FiLogIn, title: "Login", path: "/login" },
      { icon: FiUsers, title: "Sign Up", path: "/signup" },
    ]

  const finalItems = currentUser?.is_superuser
    ? [...userItems, { icon: FiUsers, title: "Admin", path: "/admin" }]
    : userItems

  const listItems = finalItems.map(({ icon, title, path, external }) => (
    <Flex
      as={Link}
      to={path}
      w="100%"
      p={2}
      key={title}
      activeProps={{
        style: {
          textDecoration: "underline",
          borderRadius: "12px",
        },
      }}
      color={textColor}
      onClick={onClose}
      target={external ? "_blank" : undefined}
      _hover={{
        textDecoration: "underline",
        backgroundColor: useColorModeValue("ui.light", "ui.dark"),
        borderRadius: "12px",
        }}
    >
      <Icon as={icon} alignSelf="center" fontSize={18} />
      <Text ml={2}>{title}</Text>
    </Flex>
  ))

  const handleLogout = async () => {
    logout()
  }


  return (
    <>
      <Box>{listItems}</Box>
      {currentUser && (
        <Box>
          <Flex
            as="button"
            onClick={handleLogout}
            p={2}
            color="ui.danger"
            fontWeight="bold"
            alignItems="center"
            _hover={{
              textDecoration: "underline",
              backgroundColor: useColorModeValue("ui.light", "ui.dark"),
              borderRadius: "12px",
            }}
            w={"100%"}
          >
            <FiLogOut />
            <Text ml={2}>Log out</Text>
          </Flex>
          <Box mt={4} mb={2} borderBottom="1px solid" borderColor="ui.secondary" />
          <StorageStats />
          <Text color={textColor} noOfLines={2} fontSize="sm">
            Logged in as: {currentUser.email}
          </Text>
        </Box>
      )}
    </>
  )
}

export default SidebarItems
