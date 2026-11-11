import ReactDOM from "react-dom/client"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { App } from "./App"
import { navigate } from "./router"
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

// The main process keeps one window and points it at another tool's runner
// instead of reloading the page, so the sidebar and the settings panel keep
// their lists and state across tools.
window.cpgRunner?.onShowTool?.((target) => {
  setApiBase(`http://127.0.0.1:${target.port}`)
  navigate("/tool")
})

async function start(): Promise<void> {
  // A reload serves the page from the origin it first came from: read which
  // tool is on screen so its runner, not that origin's, answers.
  const current = await window.cpgRunner?.currentTool?.()
  if (current) setApiBase(`http://127.0.0.1:${current.port}`)

  const container = document.getElementById("root")
  if (!container) return
  ReactDOM.createRoot(container).render(
    <ThemeProvider>
      <App />
      <Toaster />
    </ThemeProvider>,
  )
  // Tell the main process the window is drawn, so the splash can close.
  window.cpgRunner?.ready()
}

void start()
