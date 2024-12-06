import React, { useEffect, useState } from "react";
import {
  Box,
  Avatar,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  useColorModeValue,
} from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import { FiLogOut, FiUser } from "react-icons/fi";

import useAuth from "../../hooks/useAuth";

async function sha256(message: string) {
  // Encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message);

  // Hash the message
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

  // Convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Convert bytes to hex string
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

const generateGravatarUrl = async (email: string | undefined) => {
  if (!email) return "https://www.gravatar.com/avatar/?d=mp"; // Default avatar
  const hash = await sha256(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?d=mp`;
};

const UserMenu = () => {
  const { logout, user } = useAuth();
  const [gravatarUrl, setGravatarUrl] = useState<string>("");
  const outlineColor = useColorModeValue("ui.main", "ui.light")

  useEffect(() => {
    const fetchGravatarUrl = async () => {
      const url = await generateGravatarUrl(user?.email);
      setGravatarUrl(url);
    };

    fetchGravatarUrl();
  }, [user?.email]);

  const handleLogout = async () => {
    logout();
  };

  return (
    <>
      {/* Desktop */}
      <Box
        display={{ base: "none", md: "block" }}
        position="fixed"
        top={4}
        right={4}
      >
        <Menu >
          <MenuButton
            as={Avatar}
            src={gravatarUrl}
            name={user?.full_name || "User"}
            size="md"
            p={1}
            data-testid="user-menu"
            border='2px'
            color={outlineColor}
            cursor={"pointer"}
          />
          <MenuList>
            <MenuItem icon={<FiUser fontSize="18px" />} as={Link} to="settings">
              My profile
            </MenuItem>
            <MenuItem
              icon={<FiLogOut fontSize="18px" />}
              onClick={handleLogout}
              color="ui.danger"
              fontWeight="bold"
            >
              Log out
            </MenuItem>
          </MenuList>
        </Menu>
      </Box>
    </>
  );
};

export default UserMenu;
