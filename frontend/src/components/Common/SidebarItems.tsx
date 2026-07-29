import { Link } from "@tanstack/react-router"
import {
  FiCodesandbox,
  FiFile,
  FiHome,
  FiInfo,
  FiLogIn,
  FiLogOut,
  FiSettings,
  FiUsers,
} from "react-icons/fi"
import { IoGlasses } from "react-icons/io5"

import useAuth from "../../hooks/useAuth"
import StorageStats from "../Files/StorageStats"

interface SidebarItemsProps {
  onClose?: () => void
}

const SidebarItems = ({ onClose }: SidebarItemsProps) => {
  const { logout, user: currentUser } = useAuth()
  const userItems = currentUser
    ? [
        { icon: FiHome, title: "Tools", path: "/" },
        { icon: FiCodesandbox, title: "My Runs", path: "/runs" },
        { icon: FiFile, title: "My Files", path: "/files" },
        { icon: FiInfo, title: "About", path: "/about" },
        { icon: FiSettings, title: "Settings", path: "/settings" },
        { icon: IoGlasses, title: "Stream", path: "/stream", external: true },
      ]
    : [
        { icon: FiHome, title: "Tools", path: "/" },
        { icon: FiInfo, title: "About", path: "/about" },
        { icon: FiLogIn, title: "Login", path: "/login" },
        { icon: FiUsers, title: "Sign Up", path: "/signup" },
      ]

  const items = currentUser?.is_superuser
    ? [...userItems, { icon: FiUsers, title: "Admin", path: "/admin" }]
    : userItems

  return (
    <>
      <nav>
        {items.map(({ icon: ItemIcon, title, path, external }) => (
          <Link
            role="menuitem"
            to={path}
            key={title}
            activeProps={{ className: "underline bg-accent" }}
            className="flex w-full items-center rounded-md p-2 text-primary hover:bg-accent hover:underline dark:text-foreground"
            onClick={onClose}
            target={external ? "_blank" : undefined}
          >
            <ItemIcon className="size-[18px]" />
            <span className="ml-2">{title}</span>
          </Link>
        ))}
      </nav>
      {currentUser && (
        <div>
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center rounded-md p-2 font-bold text-destructive hover:bg-accent hover:underline"
          >
            <FiLogOut />
            <span className="ml-2">Log out</span>
          </button>
          <div className="my-2 border-b" />
          <StorageStats />
          <p className="mt-2 line-clamp-2 text-sm text-primary dark:text-foreground">
            {currentUser.email}
          </p>
        </div>
      )}
    </>
  )
}

export default SidebarItems
