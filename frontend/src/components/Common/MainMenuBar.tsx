import Logo from "/assets/images/cpg-logo.png"
import Icon from "/assets/images/cpg-logo-icon.png"
import {
  Box,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
  Flex,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react"
import { Link } from "@tanstack/react-router"
import { FiLogOut, FiMenu } from "react-icons/fi"
import useAuth from "../../hooks/useAuth"
import { useQueryClient } from "@tanstack/react-query";
import { UserPublic } from "../../client";
import SidebarItems from "./SidebarItems"
import StorageStats from "../Files/StorageStats"
import UserMenu from "./UserMenu"
import { HiOutlineSearch } from "react-icons/hi";

const items = [
  { title: "Tools", path: "/" },
  { title: "My Runs", path: "/runs" },
  { title: "My Files", path: "/files" },
]


function MainMenuBar() {
  const queryClient = useQueryClient()
  const bgColor = useColorModeValue("white", "ui.dark")
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const textColor = useColorModeValue("ui.dark", "ui.light")
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { logout } = useAuth()

  const finalItems = currentUser?.is_superuser
    ? [...items, { title: "Admin", path: "/admin" }]
    : items

  const listItems = finalItems.map(({ title, path }) => (
      <Flex
        as={Link}
        to={path}
        key={title}
        color={textColor}
        _hover={{ color: "ui.main" }}
        fontWeight={"semibold"}
      >
        <Text>{title}</Text>
      </Flex>
    ))
  
  const handleLogout = async () => {
    logout()
  }
  return (
    <Flex  w={'100%'} bg={bgColor} color={textColor} justify={'space-between'} align={'center'} py={2} pl={4} pr={6}>
        {/* Logo */}
        <Flex flexGrow={1} align={'center'} gap={4} mr={4}>
          <Flex>
            <Image display={{ base: "none", md: "block" }} src={Logo} alt="Logo" py={2} ml={3} maxH={14} />
            <Image display={{ base: "block", md: "none" }} src={Icon} alt="Logo" py={2}  maxH={14} />
          </Flex>
          <Box flexGrow={1} maxW={"xl"}>
            <InputGroup >
              <InputLeftElement pointerEvents='none'>
                <HiOutlineSearch color='gray.300' />
              </InputLeftElement>
              <Input bg={secBgColor} type='search' placeholder='Search the Portal'/>
            </InputGroup>
          </Box>
          <Flex gap={4} display={{ base: "none", md: "flex" }}>
            {listItems} 
          </Flex>
        </Flex>
        <Flex>
          <UserMenu />
          <IconButton
            onClick={onOpen}
            display={{ base: "flex", md: "none" }}
            aria-label="Open Menu"
            fontSize="20px"
            icon={<FiMenu />}
          />
          <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
            <DrawerOverlay />
            <DrawerContent maxW="250px">
              <DrawerCloseButton />
              <DrawerBody py={0}>
                <Flex flexDir="column" justify="space-between">
                  <Box>
                    <Image src={Logo} alt="logo" p={4} />
                    <SidebarItems onClose={onClose} />
                    <Flex
                      as="button"
                      onClick={handleLogout}
                      p={2}
                      color="ui.danger"
                      fontWeight="bold"
                      alignItems="center"
                    >
                      <FiLogOut />
                      <Text ml={2}>Log out</Text>
                    </Flex>
                  </Box>
                  {currentUser?.email && (
                    <Text color={textColor} noOfLines={2} fontSize="sm" p={2}>
                      Logged in as: {currentUser.email}
                    </Text>
                  )}
                  <StorageStats />
                </Flex>
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        </Flex>
    </Flex>
  );
}

export default MainMenuBar;