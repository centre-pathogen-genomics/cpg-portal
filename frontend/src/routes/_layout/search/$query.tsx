import { createFileRoute } from "@tanstack/react-router"
import ToolsGrid from "../../../components/Tools/ToolsGrid"

export const Route = createFileRoute("/_layout/search/$query")({
  component: SearchResults,
  head: () => ({ meta: [{ title: "Search | CPG Portal" }] }),
})

function SearchResults() {
  const { query } = Route.useParams()
  return (
    <div className="w-full px-4 md:px-6">
      <div className="my-8 flex flex-col items-center">
        <h1 className="text-4xl font-bold">{query}</h1>
      </div>
      <ToolsGrid search={query} />
    </div>
  )
}
