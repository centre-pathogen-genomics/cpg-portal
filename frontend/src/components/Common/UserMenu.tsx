import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useAuth from "../../hooks/useAuth"
import SidebarItems from "./SidebarItems"

async function sha256(message: string) {
  const bytes = new TextEncoder().encode(message)
  const hash = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

const generateGravatarUrl = async (email?: string) => {
  if (!email) return "/assets/images/user.png"
  return `https://www.gravatar.com/avatar/${await sha256(email.trim().toLowerCase())}?d=mp`
}

const UserMenu = () => {
  const { user } = useAuth()
  const [gravatarUrl, setGravatarUrl] = useState("/assets/images/user.png")

  useEffect(() => {
    generateGravatarUrl(user?.email).then(setGravatarUrl)
  }, [user?.email])

  return (
    <div className="hidden md:block">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid="user-menu"
            className="rounded-full outline-none hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Avatar className="size-12 border-[2.5px] border-primary bg-gray-300">
              <AvatarImage src={gravatarUrl} alt={user?.full_name || "User"} />
              <AvatarFallback>
                {(user?.full_name || user?.email || "U").slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-2">
          <SidebarItems />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default UserMenu
