import { createFileRoute, Link } from "@tanstack/react-router"
import { Check } from "lucide-react"
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
  const checklist = [
    "Drag-and-drop genomics data uploads",
    "Version-pinned, reproducible workflows",
    "Hosted or local deployment for real-world labs",
  ]

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 xl:px-12">
      <section className="mx-auto grid max-w-7xl gap-4 py-8 md:py-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center lg:gap-14">
        <div className="order-2 flex flex-col items-center text-center lg:order-1 lg:items-start lg:text-left">
          <h1 className="max-w-4xl text-4xl leading-tight font-bold tracking-normal text-foreground md:text-6xl">
            Pathogen genomics{" "}
            <span className="text-primary">without the command line</span>
          </h1>

          <p className="lg:block hidden  mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
            The CPG Portal turns complex bioinformatics pipelines into a
            browser-based experience for laboratories, outbreak response teams,
            and pathogen-genomics specialists.
          </p>

          <ul className="lg:block hidden  mt-8 space-y-4 text-left">
            {checklist.map((item) => (
              <li key={item} className="flex items-start gap-3 text-base">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-4" aria-hidden="true" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {!currentUser && (
            <div className="mt-9 flex w-full max-w-2xl flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Button asChild size="lg" className="rounded-full px-6">
                <Link to="/signup">Sign Up</Link>
              </Button>
              <Button asChild variant="link" size="lg" className="px-2">
                <Link to="/about">Learn More</Link>
              </Button>
            </div>
          )}
        </div>

        <div className="order-1 flex flex-col items-center justify-center text-center lg:order-2 lg:rounded-lg lg:border lg:bg-card lg:p-10 lg:shadow-sm">
          <img
            src={Logo}
            alt="CPG logo"
            className="h-auto w-full max-w-xs md:max-w-md lg:max-w-xl"
          />
          <p className=" lg:block hidden mt-6 max-w-xl text-base leading-7 text-foreground/80 md:text-lg italic">
            Explore and run tools from the most talented and accomplished
            scientists ready to take on your next project.
          </p>
        </div>
      </section>

      <div id="tools" className="scroll-mt-24">
        <ToolsGrid hideFilters={currentUser === undefined} />
      </div>
    </div>
  )
}
