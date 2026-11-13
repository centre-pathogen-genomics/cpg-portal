import {
  createFileRoute,
  Outlet,
  redirect,
  ScrollRestoration,
} from "@tanstack/react-router"

import UploadProgress from "@/components/Common/GlobalUploadProgressBar"
import MainMenuBar from "@/components/Common/MainMenuBar"
import { FileLoaderProvider } from "@/components/Render/fileSource"
import { portalFileLoader } from "@/components/Render/portalFileLoader"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    const isPublicPage =
      window.location.pathname === "/" ||
      window.location.pathname.startsWith("/tools/")

    if (!isLoggedIn() && !isPublicPage) {
      throw redirect({
        to: "/login",
        // Come back here once they are logged in.
        search: {
          redirect: window.location.pathname + window.location.search,
        },
      })
    }
  },
})

function Layout() {
  return (
    <FileLoaderProvider loader={portalFileLoader}>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <ScrollRestoration />
        <MainMenuBar />
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
        <UploadProgress />
      </div>
    </FileLoaderProvider>
  )
}
