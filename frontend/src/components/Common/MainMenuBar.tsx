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
  useColorMode,
  useColorModeValue,
  useDisclosure,
  Badge,
} from "@chakra-ui/react"
import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { FiMenu } from "react-icons/fi"
import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi";

import useAuth from "../../hooks/useAuth"
import SidebarItems from "./SidebarItems"
import UserMenu from "./UserMenu"
import { HiOutlineSearch } from "react-icons/hi";
import { useForm } from "react-hook-form"


function DarkModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode()
  return (
    <IconButton
      aria-label="Toggle dark mode"
      icon={colorMode === "dark" ? <HiOutlineSun /> : <HiOutlineMoon />}
      onClick={toggleColorMode}
      variant="ghost"
      fontSize='24px'
    />
  )
}


function MainMenuBar() {
  const bgColor = useColorModeValue("white", "ui.dark")
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const textColor = useColorModeValue("ui.dark", "ui.light")
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()

   // Use useRouter to get the current pathname.
   const router = useRouterState()
   const pathname = router.location.pathname

  const signedIn = currentUser !== undefined
  const userItems = signedIn ? [
    { title: "Tools", path: "/" },
    { title: "My Runs", path: "/runs" },
    { title: "My Files", path: "/files" },
    { title: "SAE", path: "/wasm/jupyterlite/index.html", isNew: true, newTab: true },
    { title: "About", path: "/about" },
  ] : [{ title: "About", path: "/about" }]

  const superUserItems = currentUser?.is_superuser
    ? [...userItems, { title: "Admin", path: "/admin" }]
    : userItems

  const finalItems: { title: string, path: string, isNew?: boolean, newTab?: boolean }[] = [...superUserItems]

  // Map over the final items and determine if they are active.
  const listItems = finalItems.map(({ title, path, isNew, newTab }) => {
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

    if (newTab) {
      return (
        <Flex
          as="a"
          href={path}
          key={title}
          color={textColor}
          _hover={{ color: "ui.main" }}
          fontWeight="semibold"
          align="center"
          whiteSpace={'nowrap'}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Text>{title}</Text>{isNew && (<Badge ml={1}>New</Badge>)}
        </Flex>
      )
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
        align="center"
        whiteSpace={'nowrap'}
      >
        <Text>{title}</Text>{isNew && (<Badge ml={1}>New</Badge>)}
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
      if (search === "") {
        navigate({to:`/`, resetScroll: true})
        return
      }
      navigate({to:`/search/${search}`})
    }

  return (
    <Flex position={'sticky'} top={0}  w={'100%'} bg={bgColor} color={textColor} justify={'space-between'} align={'center'} py={2} pl={4} pr={6} zIndex={1000}>
        
        <Flex flexGrow={1} align={'center'} gap={4} mr={4}>
          {/* Logo */}
          <Flex as={Link} to="/" >
            <Image display={{ base: "none", md: "block" }} src={Logo} alt="Logo" py={2} ml={3} maxH={14} />
            <Image display={{ base: "block", md: "none" }} src={Icon} alt="Logo" py={2}  maxH={14} />
          </Flex>
          {/* Search Bar */}
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
          {/* Navigation Links */}
          <Flex gap={4} display={{ base: "none", md: "flex" }}>
            {listItems} 
          </Flex>
        </Flex>
        <Box mx={2} display={{ base: "none", md: "block" }}>
          <DarkModeToggle />
        </Box>
        {currentUser ? (
          <Flex>
            <UserMenu />
          </Flex>) : (
            // If not signed in, show login/signup links
            <Flex gap={4} display={{ base: "none", md: "flex" }}>
              <Link to="/signup">
                <Text color={textColor} _hover={{ color: "ui.main" }} fontWeight="semibold">Sign Up</Text>
              </Link>
              <Link to="/login">
                <Text color={textColor} _hover={{ color: "ui.main" }} fontWeight="semibold">Log In</Text>
              </Link>
            </Flex>
          )}
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
                  </Box>
                </Flex>
              </DrawerBody>
            </DrawerContent>
          </Drawer>
    </Flex>
  );
}

export default MainMenuBar;