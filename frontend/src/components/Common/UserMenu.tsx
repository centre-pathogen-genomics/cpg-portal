import { useEffect, useState } from "react";
import {
  Box,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  useDisclosure,
  useColorModeValue,
} from "@chakra-ui/react";

import useAuth from "../../hooks/useAuth";
import SidebarItems from "./SidebarItems";

async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const generateGravatarUrl = async (email?: string) => {
  if (!email) return "/assets/images/user.png";
  const hash = await sha256(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?d=mp`;
};

const UserMenu = () => {
  const { user } = useAuth();
  const [gravatarUrl, setGravatarUrl] = useState("/assets/images/user.png");
  const outlineColor = useColorModeValue("ui.main", "ui.light");

  // useDisclosure gives us isOpen, onOpen, onClose
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    const fetchGravatarUrl = async () => {
      const url = await generateGravatarUrl(user?.email);
      setGravatarUrl(url);
    };
    fetchGravatarUrl();
  }, [user?.email]);

  return (
    <Box display={{ base: "none", md: "block" }}>
      <Menu isOpen={isOpen} onClose={onClose}>
        <MenuButton
          as={Avatar}
          src={gravatarUrl}
          size="md"
          data-testid="user-menu"
          borderWidth={2.5}
          borderColor="ui.main"
          cursor="pointer"
          bg="gray.300"
          onClick={onOpen}        // open when clicked
          _hover={{ outline: `2px solid ${outlineColor}` }}
        />
        <MenuList p={2} maxW={"80px"}>
          <SidebarItems onClose={onClose} />
        </MenuList>
      </Menu>
    </Box>
  );
};

export default UserMenu;
