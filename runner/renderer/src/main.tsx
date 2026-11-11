import ReactDOM from "react-dom/client"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { App } from "./App"
import { setSessionToken } from "./api"
import "./index.css"

const token = new URLSearchParams(window.location.search).get("token")
if (token) {
  setSessionToken(token)
  // Drop the token from the address bar but keep the route: `/run?id=...` must
  // survive, or a reload would lose which run it shows.
  const url = new URL(window.location.href)
  url.searchParams.delete("token")
  const query = url.searchParams.toString()
  window.history.replaceState(
    {},
    "",
    `${url.pathname}${query ? `?${query}` : ""}`,
  )
}

const container = document.getElementById("root")
if (container) {
  ReactDOM.createRoot(container).render(
    <ThemeProvider>
      <App />
      <Toaster />
    </ThemeProvider>,
  )
}
