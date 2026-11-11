import { useRoute } from "./router"
import { RunPage } from "./run"
import { ToolPage } from "./tool"
import { ToolsPage } from "./tools"

export function App() {
  const route = useRoute()
  if (route.page === "run") return <RunPage id={route.id} />
  if (route.page === "tool") return <ToolPage />
  return <ToolsPage />
}
