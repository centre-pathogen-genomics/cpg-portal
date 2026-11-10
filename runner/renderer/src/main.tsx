import ReactDOM from "react-dom/client"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { App } from "./App"
import { setSessionToken } from "./api"
import "./index.css"

const token = new URLSearchParams(window.location.search).get("token")
if (token) {
  setSessionToken(token)
  window.history.replaceState({}, "", window.location.pathname)
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
