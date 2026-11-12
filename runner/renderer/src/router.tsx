import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router"
import { setApiBase, toolApiBase } from "./api"
import { RunPage } from "./run"
import { ToolPage } from "./tool"
import { ToolsPage } from "./tools"

const rootRoute = createRootRoute({ component: Outlet })

const toolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ToolsPage,
})

const toolRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/t/$toolId/tool",
  validateSearch: (search: Record<string, unknown>): { rerun?: string } => ({
    rerun: typeof search.rerun === "string" ? search.rerun : undefined,
  }),
  beforeLoad: ({ params }) => setApiBase(toolApiBase(params.toolId)),
  component: ToolRoute,
})

const runRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/t/$toolId/run/$runId",
  beforeLoad: ({ params }) => setApiBase(toolApiBase(params.toolId)),
  component: RunRoute,
})

// The tool page stays mounted across a switch and reloads only what belongs to
// the tool, so its sidebar and run settings never fall back to an empty page.
function ToolRoute() {
  const { toolId } = toolRoute.useParams()
  return <ToolPage toolId={toolId} />
}

function RunRoute() {
  const { toolId, runId } = runRoute.useParams()
  return <RunPage key={`${toolId}:${runId}`} toolId={toolId} runId={runId} />
}

const routeTree = rootRoute.addChildren([toolsRoute, toolRoute, runRoute])

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: ToolsPage,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
