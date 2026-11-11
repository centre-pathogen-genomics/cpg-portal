import ReactDOM from "react-dom/client"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { App } from "./App"
import { setApiBase, setSessionToken } from "./api"
import "./index.css"

const params = new URLSearchParams(window.location.search)
const token = params.get("token")
const api = params.get("api")
if (token) setSessionToken(token)
if (api) setApiBase(api)
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

const container = document.getElementById("root")
if (container) {
  ReactDOM.createRoot(container).render(
    <ThemeProvider>
      <App />
      <Toaster />
    </ThemeProvider>,
  )
}
