import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { HiOutlinePlay } from "react-icons/hi2"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ToolMinimalPublic } from "../../client"
import useAuth from "../../hooks/useAuth"
import FavouriteButton from "./FavouriteButton"
import RunToolModal from "./RunToolModal"

const fallbackImage =
  "https://images.unsplash.com/photo-1543145499-8193615267de?auto=format&fit=crop&w=800&q=60"

/** One compact line for the list view of the tool list. */
const ToolRow = ({ tool }: { tool: ToolMinimalPublic }) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [isFavourited, setIsFavourited] = useState(tool.favourited ?? false)
  const { user } = useAuth()

  return (
    <>
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-md border bg-card px-3 py-2",
          "transition-colors hover:bg-accent/50",
        )}
      >
        {/* The whole line opens the tool, so a stray click does not have to
            find the name. */}
        <Link
          to="/tools/$name"
          params={{ name: tool.name }}
          aria-label={`Open ${tool.name}`}
          className="absolute inset-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        <img
          src={tool.image || fallbackImage}
          alt=""
          className="pointer-events-none size-9 shrink-0 rounded object-cover"
        />
        <div className="pointer-events-none min-w-0 flex-1">
          <div className="truncate font-semibold">{tool.name}</div>
          {tool.description && (
            <div className="truncate text-sm text-muted-foreground">
              {tool.description}
            </div>
          )}
        </div>
        <div className="pointer-events-none hidden shrink-0 items-center gap-1 md:flex">
          {tool.tags?.slice(0, 3).map((tag) => (
            <Badge variant="secondary" className="shrink-0" key={tag}>
              {tag}
            </Badge>
          ))}
        </div>
        <span className="pointer-events-none flex shrink-0 items-center gap-0.5 text-sm text-gray-500">
          <HiOutlinePlay />
          {tool.run_count || 0}
        </span>
        {user && (
          <div className="relative z-10 flex shrink-0 items-center">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Run"
              title="Run tool"
              onClick={() => setModalOpen(true)}
            >
              <HiOutlinePlay />
            </Button>
            <FavouriteButton
              tool={tool}
              isFavourited={isFavourited}
              setIsFavourited={setIsFavourited}
              withCount
            />
          </div>
        )}
      </div>
      <RunToolModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        toolId={tool.id}
        status={tool.status}
        params={tool.params || []}
        minCpus={tool.min_cpus}
        maxCpus={tool.max_cpus}
        defaultCpus={tool.default_cpus}
      />
    </>
  )
}

export default ToolRow
