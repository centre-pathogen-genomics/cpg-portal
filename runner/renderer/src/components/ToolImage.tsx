import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * A tool's picture, as the main process cached it on first load. Without a
 * cached picture the first letter stands in, so the window works offline.
 */
export function placeholderImage(name: string): string {
  const letter = (name.trim()[0] ?? "?").toUpperCase()
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="10" fill="#2f3033"/>` +
    `<text x="32" y="43" font-family="system-ui,-apple-system,sans-serif" ` +
    `font-size="30" font-weight="600" text-anchor="middle" fill="#9aa0a6">` +
    `${letter}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function ToolImage({
  id,
  name,
  images,
  className,
}: {
  id: string
  name: string
  images: Record<string, string>
  className?: string
}) {
  return (
    <img
      src={images[id] ?? placeholderImage(name)}
      alt={name}
      className={cn("shrink-0 rounded-md border object-cover", className)}
    />
  )
}

/** The cached pictures the main process holds, by tool id. */
export function useToolImages(): Record<string, string> {
  const [images, setImages] = useState<Record<string, string>>({})
  useEffect(() => {
    const load = () => {
      void window.cpgRunner
        ?.toolImages?.()
        .then(setImages)
        .catch(() => {})
    }
    load()
    // A tool added just now gets its picture a moment later.
    return window.cpgRunner?.onToolsChanged?.(load)
  }, [])
  return images
}
