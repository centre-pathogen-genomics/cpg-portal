import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { AxiosError } from "axios"
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { client } from "./client/client.gen"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/sonner"
import "./index.css"
import { UploadProvider } from "./context/UploadContext"
import { routeTree } from "./routeTree.gen"

client.setConfig({
  baseURL: import.meta.env.VITE_API_URL,
  auth: () => localStorage.getItem("access_token") ?? undefined,
})

const getApiStatus = (error: unknown) =>
  error instanceof AxiosError ? (error.response?.status ?? error.status) : null

const handleApiError = (error: unknown) => {
  const status = getApiStatus(error)
  if (status && [401, 403].includes(status)) {
    localStorage.removeItem("access_token")
    window.location.href = "/login"
  }
}
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = getApiStatus(error)
        if (status && [401, 403].includes(status)) return false
        return failureCount < 3
      },
    },
  },
  queryCache: new QueryCache({
    onError: handleApiError,
  }),
  mutationCache: new MutationCache({
    onError: handleApiError,
  }),
})

const router = createRouter({ routeTree })
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <UploadProvider>
          <RouterProvider router={router} />
          <Toaster richColors closeButton />
        </UploadProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
