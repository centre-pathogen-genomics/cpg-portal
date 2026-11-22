import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import ReactDOM from "react-dom/client"
import { useEffect } from "react"
import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { setApiOrigin, setSessionToken } from "./api"
import { UpdateBanner } from "./components/UpdateBanner"
import { setPortalUrl } from "./lib/portal"
import { router } from "./router"
import "./index.css"

// Development only: the app server's origin, which is not the page's. Kept in
// session storage so a reload — which no longer carries `?api=` in the address
// bar — still reaches the API through the proxy.
const API_ORIGIN_KEY = "cpg-runner:api-origin"

const params = new URLSearchParams(window.location.search)
const token = params.get("token")
const api = params.get("api")
if (token) setSessionToken(token)
if (api) {
  setApiOrigin(api)
  window.sessionStorage.setItem(API_ORIGIN_KEY, api)
} else {
  const saved = window.sessionStorage.getItem(API_ORIGIN_KEY)
  if (saved) setApiOrigin(saved)
}
if (token || api) {
  // Drop the token and the API origin from the address bar but keep the route:
  // `/run?id=...` must survive, or a reload would lose which run it shows.
  const url = new URL(window.location.href)
  url.searchParams.delete("token")
  url.searchParams.delete("api")
  const query = url.searchParams.toString()
  window.history.replaceState(
    {},
    "",
    `${url.pathname}${query ? `?${query}` : ""}`,
  )
}

// One page, many tools: opening another one is a route, not a reload, so the
// sidebar and the settings panel keep their lists and state across tools.
window.cpgRunner?.onShowTool?.((target) => {
  void router.navigate({
    to: "/t/$toolId/tool",
    params: { toolId: target.toolId },
  })
})

// A portal chosen in Settings outranks the one this build shipped with, once
// the main process has read it back.
void window.cpgRunner?.getPortalUrl?.().then((url) => {
  if (url) setPortalUrl(url)
})

// The tool the page shows was removed: go back to the list of what is left.
window.cpgRunner?.onToolRemoved?.((target) => {
  const shown = router.state.matches.at(-1)?.params as
    | { toolId?: string }
    | undefined
  if (shown?.toolId === target.toolId) void router.navigate({ to: "/" })
})

// The page paints itself; the window's native chrome and the background it
// loads onto are the main process's job, so every theme change (and the first
// paint) is reported for the shell to follow.
function ShellTheme(): null {
  const { theme, resolvedTheme } = useTheme()
  useEffect(() => {
    void window.cpgRunner?.setShellTheme?.(theme, resolvedTheme)
  }, [theme, resolvedTheme])
  return null
}

function start(): void {
  const container = document.getElementById("root")
  if (!container) return
  // The portal's file renderers read their bytes through react-query, so the
  // runner needs a cache of its own; a failed read is shown, never retried.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  ReactDOM.createRoot(container).render(
    <ThemeProvider>
      <ShellTheme />
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster closeButton />
        <UpdateBanner />
      </QueryClientProvider>
    </ThemeProvider>,
  )
  // Tell the main process the window is drawn, so the splash can close.
  window.cpgRunner?.ready()
}

start()
