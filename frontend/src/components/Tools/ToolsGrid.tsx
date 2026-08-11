import { useSuspenseQuery } from "@tanstack/react-query"
import type React from "react"
import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import ErrorLogo from "/assets/images/500.png"
import type { ToolsOrderBy } from "../../client"
import { readToolsOptions } from "../../client/@tanstack/react-query.gen"
import ToolCard from "./ToolCard"

function ToolCards({
  orderBy,
  showFavourites,
  search,
}: {
  orderBy: ToolsOrderBy
  showFavourites: boolean
  search?: string
}) {
  const { data: tools } = useSuspenseQuery({
    ...readToolsOptions({
      query: { order_by: orderBy, show_favourites: showFavourites, search },
    }),
  })
  return (
    <>
      {!tools.data.length && (
        <div className="flex h-[200px] items-center justify-center">
          <h2 className="text-lg font-semibold">No matches found</h2>
        </div>
      )}
      <div className="mb-8 grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
        {tools.data.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </>
  )
}

function ToolsGrid({
  search,
  hideFilters,
}: {
  search?: string
  hideFilters?: boolean
}) {
  const [orderBy, setOrderBy] = useState<ToolsOrderBy>("run_count")
  const [showFavourites, setShowFavourites] = useState(false)
  return (
    <>
      <div className="mt-2">
        <div className="flex flex-col gap-2">
          <div>
            <div className="text-2xl font-semibold tracking-normal">
              All tools
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Browse all tools available on the CPG Portal
              </p>
            </div>
          </div>
          <div className="flex flex-row justify-between gap-2 mb-2">
            <select
              className="h-10 w-full min-w-0 rounded-md border bg-background px-3 min-[420px]:w-[200px]"
              value={orderBy}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setOrderBy(event.target.value as ToolsOrderBy)
              }
            >
              <option value="run_count">Popular</option>
              <option value="created_at">New &amp; Noteworthy</option>
            </select>
            {!hideFilters && (
              <div className="flex items-center">
                <div className="flex items-center gap-1">
                  <Label htmlFor="show-favourites">Favourites</Label>
                  <Switch
                    id="show-favourites"
                    checked={showFavourites}
                    onCheckedChange={setShowFavourites}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ErrorBoundary
        fallbackRender={() => (
          <div className="mt-8 flex w-full flex-col items-center text-center">
            <p>Something went wrong... Please reload the page!</p>
            <img src={ErrorLogo} alt="Error" className="max-w-80" />
          </div>
        )}
      >
        <Suspense fallback={<Skeleton className="mb-8 h-[260px] w-full" />}>
          <ToolCards
            orderBy={orderBy}
            showFavourites={showFavourites}
            search={search}
          />
        </Suspense>
      </ErrorBoundary>
    </>
  )
}

export default ToolsGrid
