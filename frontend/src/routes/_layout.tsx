declare global {
  interface Window {
    __tokenCheckTimestamp?: number;
  }
}

import { Flex, Box, Spinner } from "@chakra-ui/react"
import { Outlet, ScrollRestoration, createFileRoute, redirect } from "@tanstack/react-router"

import MainMenuBar from "../components/Common/MainMenuBar"
import UploadProgress from "../components/Common/GlobalUploadProgressBar"
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
    const isIndex = window.location.pathname === "/";
    const isTool = window.location.pathname.startsWith("/tools/");
    if (!tokenIsValid && !(isIndex || isTool)) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.pathname,
        },
      });
    } else if (!tokenIsValid && (isIndex || isTool)) {
      // If the token is invalid and the user is on the index or tool page, allow
      // the page to load the tool form will be disabled
      return;
    }
    
    // Update the global timestamp
    window.__tokenCheckTimestamp = now;
  },
});

function Layout() {
  const { isLoading } = useAuth()

  return (
    <Flex position="relative" direction={'column'} h="100%" overflow={"hidden"}>
      <ScrollRestoration/>
      {/* Navbar */}
      <MainMenuBar />
     
      {/* Main content area */}
      <Flex flex="1" flexDirection="row" h="100%" overflow={"auto"}>
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
            <Box flex="1" h={"100%"} overflowX={"auto"}>
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
