declare global {
  interface Window {
    __tokenCheckTimestamp?: number;
  }
}

import { Flex, Box, Spinner } from "@chakra-ui/react"
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"

import Sidebar from "../components/Common/Sidebar"
import MainMenuBar from "../components/Common/MainMenuBar"
import UploadProgress from "../components/Files/UploadProgress"
import useAuth, { checkToken} from "../hooks/useAuth"
import { UploadProvider } from "../context/UploadContext"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    const THIRTY_MINUTES = 30 * 60 * 1000;
    const now = Date.now();
    
    // Use a global variable to track the last check (only persists in-memory)
    if (window.__tokenCheckTimestamp && (now - window.__tokenCheckTimestamp) < THIRTY_MINUTES) {
      return; // Skip the check if within 30 minutes
    }
    
    const tokenIsValid = await checkToken();
    if (!tokenIsValid) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.pathname,
        },
      });
    }
    
    // Update the global timestamp
    window.__tokenCheckTimestamp = now;
  },
});

function Layout() {
  const { isLoading } = useAuth()

  return (
    <Flex h="100dvh" position="relative" direction={'column'} overflow="hidden">
      {/* Navbar */}
      <Box w={'100%'} zIndex={1000}>
        <MainMenuBar />
      </Box>
     
      {/* Main content area */}
      <Flex flex="1" flexDirection="row" h="100%" overflow="auto">
         {/* Sidebar with fixed width */}
        {/* <Box h="100%">
          <Sidebar />
        </Box> */}

        {isLoading ? (
          <Flex justify="center" align="center" height="100%" width="100%">
            <Spinner size="xl" color="ui.main" />
          </Flex>
        ) : (
          <UploadProvider>
            <Box flex="1" overflow="auto" px={{md:4, base: 0}} >
              <Outlet />
            </Box>
            <UploadProgress />
          </UploadProvider>
        )}
      </Flex>

      {/* User Menu (optional, floating, or positioned appropriately) */}

    </Flex>
  )
}
