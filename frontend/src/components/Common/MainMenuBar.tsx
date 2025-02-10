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
  FormControl,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react"
import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { FiLogOut, FiMenu } from "react-icons/fi"
import useAuth from "../../hooks/useAuth"
import { useQueryClient } from "@tanstack/react-query";
import { UserPublic } from "../../client";
import SidebarItems from "./SidebarItems"
import StorageStats from "../Files/StorageStats"
import UserMenu from "./UserMenu"
import { HiOutlineSearch } from "react-icons/hi";
import { useForm } from "react-hook-form"

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
  const navigate = useNavigate()

   // Use useRouter to get the current pathname.
   const router = useRouterState()
   const pathname = router.location.pathname


  const finalItems = currentUser?.is_superuser
    ? [...items, { title: "Admin", path: "/admin" }]
    : items

  // Map over the final items and determine if they are active.
  const listItems = finalItems.map(({ title, path }) => {
    let isActive = false

    if (title === "Tools") {
      // For the Tools item, we want it active if the pathname is exactly "/"
      // or if it starts with "/tools". (This is a special case since every pathname starts with "/"!)
      isActive = pathname === "/" || pathname.startsWith("/tools")
    } else {
      // For other items, check if the current pathname starts with the item path.
      // This ensures subpaths (like "/runs/123") will also be underlined.
      isActive = pathname.startsWith(path)
    }

    return (
      <Flex
        as={Link}
        to={path}
        key={title}
        color={textColor}
        _hover={{ color: "ui.main" }}
        fontWeight="semibold"
        // Apply underline style if active.
        style={isActive ? { textDecoration: "underline" } : {}}
      >
        <Text>{title}</Text>
      </Flex>
    )
  })

    const defaultValues = {
      search: "",
    }

    type FormData = {
      search?: string
    }

    const {
      register,
      handleSubmit,
    } = useForm<FormData>({
      defaultValues})

    function onSubmit({ search }: FormData) {
      console.log(search)
      if (search === "") {
        navigate({to:`/`, resetScroll: true})
        return
      }
      navigate({to:`/search/${search}`})
    }
  const handleLogout = async () => {
    logout()
  }
  return (
    <Flex position={'sticky'} top={0}  w={'100%'} bg={bgColor} color={textColor} justify={'space-between'} align={'center'} py={2} pl={4} pr={6} zIndex={1000}>
        {/* Logo */}
        <Flex flexGrow={1} align={'center'} gap={4} mr={4}>
          <Flex as={Link} to="/" >
            <Image display={{ base: "none", md: "block" }} src={Logo} alt="Logo" py={2} ml={3} maxH={14} />
            <Image display={{ base: "block", md: "none" }} src={Icon} alt="Logo" py={2}  maxH={14} />
          </Flex>
          <Box flexGrow={1} maxW={"xl"} as="form" onSubmit={handleSubmit(onSubmit)}>
            <FormControl >
              <InputGroup>
                <InputLeftElement pointerEvents='none'>
                  <HiOutlineSearch color='gray.300' />
                </InputLeftElement>
                <Input 
                {...register("search", {required: false})}
                id="search" bg={secBgColor} type='search' placeholder='Search the Portal' />
              </InputGroup>
            </FormControl>
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