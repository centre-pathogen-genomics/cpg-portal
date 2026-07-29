import {
  createFileRoute,
  Outlet,
  redirect,
  ScrollRestoration,
} from "@tanstack/react-router"

import UploadProgress from "@/components/Common/GlobalUploadProgressBar"
import MainMenuBar from "@/components/Common/MainMenuBar"
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
      })
    }
  },
})

function Layout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <ScrollRestoration />
      <MainMenuBar />
      <main className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
      <UploadProgress />
    </div>
  )
}
