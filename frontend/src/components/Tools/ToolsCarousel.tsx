import { useSuspenseQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Suspense, useMemo, useRef } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { readToolsOptions } from "../../client/@tanstack/react-query.gen"
import ToolCard from "./ToolCard"

function ToolsCarouselContent({
  tag,
  title,
  subtitle,
  limit,
}: {
  tag: string
  title?: string
  subtitle?: string
  limit?: number
}) {
  const carouselRef = useRef<HTMLDivElement>(null)
  const { data: tools } = useSuspenseQuery({
    ...readToolsOptions({
      query: { order_by: "run_count", show_favourites: false, search: tag },
    }),
  })
  const normalizedTag = tag.toLowerCase()
  const matchingTools = useMemo(
    () =>
      tools.data
        .filter((tool) =>
          tool.tags?.some((toolTag) => toolTag.toLowerCase() === normalizedTag),
        )
        .slice(0, limit),
    [limit, normalizedTag, tools.data],
  )

  if (!matchingTools.length) return null

  const scrollCarousel = (direction: -1 | 1) => {
    const carousel = carouselRef.current
    if (!carousel) return

    carousel.scrollBy({
      left: direction * carousel.clientWidth * 0.85,
      behavior: "smooth",
    })
  }

  return (
    <section data-tool-carousel={tag}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">
            {title ?? `${tag} tools`}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Scroll carousel left"
            onClick={() => scrollCarousel(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Scroll carousel right"
            onClick={() => scrollCarousel(1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div
        ref={carouselRef}
        className="no-scroll -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 xl:-mx-12 xl:px-12"
      >
        {matchingTools.map((tool) => (
          <div
            key={tool.id}
            className="h-[360px] w-[min(82vw,340px)] shrink-0 snap-start sm:w-[340px]"
          >
            <ToolCard tool={tool} className="flex h-full flex-col" />
          </div>
        ))}
      </div>
    </section>
  )
}

function ToolsCarousel({
  tag,
  title,
  subtitle,
  limit = 12,
}: {
  tag: string
  title?: string
  subtitle?: string
  limit?: number
}) {
  return (
    <Suspense fallback={<Skeleton className="h-[260px] w-full" />}>
      <ErrorBoundary fallbackRender={() => null}>
        <ToolsCarouselContent tag={tag} title={title} subtitle={subtitle} limit={limit} />
      </ErrorBoundary>
    </Suspense>
  )
}

export default ToolsCarousel
