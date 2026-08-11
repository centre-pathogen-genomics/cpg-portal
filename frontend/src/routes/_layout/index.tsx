import { createFileRoute, Link } from "@tanstack/react-router"
import { Check } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import EventStreamVisualizationPixi, {
  type EventStreamVisualizationRef,
} from "@/components/EventStream/EventStreamVisualizationPixi"
import { Button } from "@/components/ui/button"
import Logo from "/assets/images/cpg-logo.png"
import IconLogoTransparent from "/assets/images/cpg-logo-icon-transparent.png"
import ToolsCarousel from "../../components/Tools/ToolsCarousel"
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
      <section className="relative mx-auto grid max-w-7xl gap-5 py-6 md:min-h-[520px] md:gap-8 md:py-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center lg:gap-14">
        <HeroStreamBackground />

        <div className="relative z-10 order-2 flex flex-col items-center text-center lg:order-1 lg:items-start lg:text-left">
          <h1 className="max-w-4xl text-3xl leading-tight font-bold tracking-normal text-foreground sm:text-4xl md:text-6xl">
            Pathogen genomics{" "}
            <span className="text-primary">without the command line</span>
          </h1>

          <p className="lg:block hidden  mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
            The CPG Portal turns complex bioinformatics tools into a
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

        <div className="relative z-10 order-1 flex flex-col items-center justify-center text-center lg:order-2">
          <div className="w-full max-w-sm rounded-lg sm:p-4 sm:shadow-sm backdrop-blur-sm sm:max-w-md md:p-8 lg:max-w-none">
            <img
              id="hero-logo-target"
              src={Logo}
              alt="CPG logo"
              className="mx-auto h-auto w-full max-w-[280px] sm:max-w-xs md:max-w-md lg:max-w-xl"
            />
            <p className=" lg:block hidden mt-6 max-w-xl text-base leading-7 text-foreground/80 md:text-lg italic">
              Explore and run tools from the most talented and accomplished
              scientists ready to take on your next project.
            </p>
          </div>
        </div>
      </section>

      <div id="tools" className="scroll-mt-24">
        <ToolsCarousel
          tag="cpg"
          title="CPG tools"
          subtitle="Tools we develop and maintain for the community"
        />
        <ToolsGrid hideFilters={currentUser === undefined} />
      </div>
    </div>
  )
}

function HeroStreamBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLElement | null>(null)
  const streamRef = useRef<EventStreamVisualizationRef>(null)
  const [geometry, setGeometry] = useState({
    width: 0,
    height: 0,
    targetX: 0,
    targetY: 0,
  })

  useEffect(() => {
    logoRef.current = document.getElementById("hero-logo-target")

    const updateGeometry = () => {
      const container = containerRef.current
      const logo = logoRef.current
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const logoRect = logo?.getBoundingClientRect()
      const fallbackTargetX = containerRect.width * 0.68
      const fallbackTargetY = containerRect.height * 0.48

      setGeometry({
        width: containerRect.width || window.innerWidth,
        height: containerRect.height || 520,
        targetX: logoRect
          ? logoRect.left - containerRect.left + logoRect.height / 2
          : fallbackTargetX,
        targetY: logoRect
          ? logoRect.top - containerRect.top + logoRect.height / 2
          : fallbackTargetY,
      })
    }

    updateGeometry()
    const resizeObserver = new ResizeObserver(updateGeometry)
    if (containerRef.current) resizeObserver.observe(containerRef.current)
    if (logoRef.current) resizeObserver.observe(logoRef.current)
    window.addEventListener("resize", updateGeometry)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateGeometry)
    }
  }, [])

  useEffect(() => {
    const toolNames = [
      "assembly",
      "typing",
      "qc",
      "variants",
      "phylogeny",
      "reporting",
    ]
    let index = 0

    const addHeroEvent = () => {
      streamRef.current?.addEvent({
        name: toolNames[index % toolNames.length],
        size: 6 * (index % 3),
        image: IconLogoTransparent,
      })
      index += 1
    }

    const seedTimer = window.setTimeout(() => {
      for (let i = 0; i < 8; i++) addHeroEvent()
    }, 300)
    const interval = window.setInterval(addHeroEvent, 150)

    return () => {
      window.clearTimeout(seedTimer)
      window.clearInterval(interval)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute top-0 left-1/2 z-0 hidden h-full w-screen -translate-x-1/2 overflow-hidden opacity-45 sm:block lg:[mask-image:linear-gradient(to_right,transparent_0%,transparent_36%,black_50%)]"
      aria-hidden="true"
    >
      {geometry.width > 0 && geometry.height > 0 && (
        <EventStreamVisualizationPixi
          ref={streamRef}
          width={geometry.width}
          height={geometry.height}
          targetX={geometry.targetX}
          targetY={geometry.targetY}
          maxCircles={25}
          mergeSameName={true}
          spawnMode="target"
          targetMode="repel"
        />
      )}
    </div>
  )
}
