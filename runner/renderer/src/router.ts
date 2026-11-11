import { useEffect, useState } from "react"

export type Route =
  | { page: "tools" }
  | { page: "tool" }
  | { page: "run"; id: string }

const TOOL_ROUTE = /^\/tool\/?$/

// Every view but the tool list lives one path segment deep. The renderer is
// built with relative asset URLs (it is also opened from file:// before a tool
// exists), so a deeper path would break the `./assets/...` references.
export function parseRoute(pathname: string, search = ""): Route {
  const runId = new URLSearchParams(search).get("id")
  if (pathname.replace(/\/$/, "") === "/run" && runId) {
    return { page: "run", id: runId }
  }
  if (TOOL_ROUTE.test(pathname)) return { page: "tool" }
  return { page: "tools" }
}

export function navigate(path: string): void {
  window.history.pushState({}, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.pathname, window.location.search),
  )

  useEffect(() => {
    const onPopState = () =>
      setRoute(parseRoute(window.location.pathname, window.location.search))
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  return route
}
