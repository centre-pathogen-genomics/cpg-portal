import { useEffect, useState } from "react"
import { Box } from "@/components/ui/chakra-compat"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import useAuth from "../../hooks/useAuth"
import SidebarItems from "./SidebarItems"

async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

const generateGravatarUrl = async (email?: string) => {
  if (!email) return "/assets/images/user.png"
  const hash = await sha256(email.trim().toLowerCase())
  return `https://www.gravatar.com/avatar/${hash}?d=mp`
}

const UserMenu = () => {
  const { user } = useAuth()
  const [gravatarUrl, setGravatarUrl] = useState("/assets/images/user.png")

  useEffect(() => {
    const fetchGravatarUrl = async () => {
      const url = await generateGravatarUrl(user?.email)
      setGravatarUrl(url)
    }
    fetchGravatarUrl()
  }, [user?.email])

  return (
    <Box display={{ base: "none", md: "block" }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid="user-menu"
            className="size-11 overflow-hidden rounded-full border-2 border-teal-600 bg-muted outline-none hover:ring-2 hover:ring-teal-500/40"
          >
            <img
              src={gravatarUrl}
              alt={user?.full_name || user?.email || "User menu"}
              className="size-full object-cover"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-2">
          <SidebarItems />
        </DropdownMenuContent>
      </DropdownMenu>
    </Box>
  )
}

export default UserMenu
