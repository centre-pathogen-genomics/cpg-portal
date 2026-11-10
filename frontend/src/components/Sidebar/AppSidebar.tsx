import { Files, FlaskConical, Play, ShieldCheck, Users } from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { hasPermission } from "@/lib/permissions"
import { type Item, Main } from "./Main"
import { User } from "./User"

const baseItems: Item[] = [
  { icon: FlaskConical, title: "Tools", path: "/" },
  { icon: Play, title: "Runs", path: "/runs" },
  { icon: Files, title: "Files", path: "/files" },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  const items = [...baseItems]
  if (currentUser?.is_superuser) {
    items.push({ icon: Users, title: "Admin", path: "/admin" })
  }
  if (hasPermission(currentUser, "rbac:read")) {
    items.push({ icon: ShieldCheck, title: "Access", path: "/rbac" })
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
