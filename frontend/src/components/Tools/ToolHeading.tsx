import type { ComponentType, ReactNode } from "react"
import { Badge } from "@/components/ui/badge"

type HeadingProps = {
  className?: string
  id?: string
  children?: ReactNode
}

/**
 * A tool's name block: its picture, the name and version pill, then a slot
 * for right-hand actions (e.g. an install button). The desktop app's tool
 * page and its portal dialog use the same one, so a tool looks the same
 * wherever it is shown.
 *
 * Kept generic: it renders only its props and has no router, API or auth
 * imports, so any host can reuse the exact same header.
 */
export function ToolHeading({
  image,
  name,
  version,
  heading: Heading = "h1",
  children,
}: {
  image: string
  name: string
  version?: string | null
  /** "h1" on a page, `DialogTitle` inside a dialog. */
  heading?: "h1" | "h2" | ComponentType<HeadingProps>
  /** Right-hand actions, e.g. a page's or dialog's buttons. */
  children?: ReactNode
}) {
  const Title = Heading as ComponentType<HeadingProps>
  return (
    <div className="flex items-center justify-between gap-2 border-b pb-2">
      <div className="flex min-w-0 items-center">
        <img
          src={image}
          alt={name}
          className="mr-2 size-12 shrink-0 rounded-md border-2 object-cover"
        />
        <Title className="truncate text-3xl font-bold">{name}</Title>
        {version && (
          <Badge className="ml-1">
            v{version}
          </Badge>
        )}
      </div>
      {children}
    </div>
  )
}
