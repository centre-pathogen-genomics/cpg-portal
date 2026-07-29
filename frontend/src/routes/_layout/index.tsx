import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import Logo from "/assets/images/cpg-logo.png"
import ToolsGrid from "../../components/Tools/ToolsGrid"
import useAuth from "../../hooks/useAuth"

export const Route = createFileRoute("/_layout/")({
  component: Tools,
  head: () => ({ meta: [{ title: "Tools | CPG Portal" }] }),
})

function Tools() {
  const { user: currentUser } = useAuth()

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 xl:px-12">
      <div className="my-8 flex flex-col items-center py-2">
        <img
          src={Logo}
          alt="CPG logo"
          className="mb-4 h-auto w-full max-w-xs self-center md:max-w-md"
        />
        <p className="max-w-full text-center text-lg md:max-w-3xl md:text-2xl">
          Explore and run tools from the most talented and accomplished
          scientists ready to take on your next project
        </p>
        {!currentUser && (
          <div className="mt-4 flex justify-center gap-4">
            <Button asChild>
              <Link to="/signup">Sign Up</Link>
            </Button>
            <Button asChild variant="link">
              <Link to="/about">Learn More</Link>
            </Button>
          </div>
        )}
      </div>
      <ToolsGrid hideFilters={currentUser === undefined} />
    </div>
  )
}
