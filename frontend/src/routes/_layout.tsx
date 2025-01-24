import { Flex, Box, Spinner } from "@chakra-ui/react"
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"

import Sidebar from "../components/Common/Sidebar"
import UserMenu from "../components/Common/UserMenu"
import UploadProgress from "../components/Files/UploadProgress"
import useAuth, { isLoggedIn } from "../hooks/useAuth"
import { UploadProvider } from "../context/UploadContext"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  const { isLoading } = useAuth()

  return (
    <Flex h="100dvh" position="relative" overflow="hidden">
      {/* Sidebar with fixed width */}
      <Box  h="100%">
        <Sidebar />
      </Box>

      {/* Main content area */}
      <Flex flex="1" flexDirection="column" h="100%" overflow="auto">
        {isLoading ? (
          <Flex justify="center" align="center" height="100%" width="100%">
            <Spinner size="xl" color="ui.main" />
          </Flex>
        ) : (
          <UploadProvider>
            <Box flex="1" overflow="auto">
              <Outlet />
            </Box>
            <UploadProgress />
          </UploadProvider>
        )}
      </Flex>

      {/* User Menu (optional, floating, or positioned appropriately) */}
      <UserMenu />
    </Flex>
  )
}
