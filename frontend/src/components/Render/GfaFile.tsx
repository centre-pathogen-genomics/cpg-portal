import type { Graph, LayoutResult } from "@jbrowse/bandage-core"
import {
  axisScaleOf,
  drawingBounds,
  ENGINE_DEFAULTS,
  FIT_PADDING,
  figureSvg,
  findHoveredNode,
  fitTransform,
  forceLayout,
  layoutEngine,
  loadGraph,
  nodeInk,
  screenToLayout,
} from "@jbrowse/bandage-core"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { downloadFileOptions } from "../../client/@tanstack/react-query.gen"

interface GfaFileProps {
  fileId: string
  fileName?: string
  compressed?: boolean
}

type GfaFigure = { graph: Graph; layout: LayoutResult } | { error: string }
interface RenderedFigure {
  svg: string
  width: number
  height: number
  drawingY: number
  drawingWidth: number
  drawingHeight: number
}
interface Hover {
  name: string
  length: number
  depth: number
  x: number
  y: number
}
interface ViewTransform {
  scale: number
  x: number
  y: number
}

// Bandage's layout is quadratic-ish in the number of nodes, and the whole file
// is already capped by FileRenderer. Refuse a graph whose drawing would stall
// the page.
const MAX_NODES = 10000
const NODE_THICKNESS = 6
const NODE_WIDTH = "depth" as const
const ROOT_SIZE = /^<svg[^>]*width="([\d.]+)" height="([\d.]+)"/
const DRAWING = /<svg y="([\d.]+)" width="([\d.]+)" height="([\d.]+)">/

const decodeBlob = async (blob: Blob, compressed: boolean) => {
  if (!compressed) {
    return blob.text()
  }
  const decompressed = blob
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
  return new Response(decompressed).text()
}

const parseFigure = (svg: string): RenderedFigure => {
  const root = ROOT_SIZE.exec(svg)
  const drawing = DRAWING.exec(svg)
  const width = Number(root?.[1] ?? 0)
  const height = Number(root?.[2] ?? 0)
  return {
    svg,
    width,
    height,
    drawingY: Number(drawing?.[1] ?? 0),
    drawingWidth: Number(drawing?.[2] ?? width),
    drawingHeight: Number(drawing?.[3] ?? height),
  }
}

const GfaFile = ({
  fileId,
  fileName = "graph.gfa",
  compressed = false,
}: GfaFileProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState<ViewTransform>({
    scale: 1,
    x: 0,
    y: 0,
  })
  const [hover, setHover] = useState<Hover | null>(null)

  const { data: blob } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId }, responseType: "blob" }),
  })

  const { data: figure } = useSuspenseQuery<GfaFigure>({
    queryKey: ["gfa-figure", fileId, compressed],
    queryFn: async () => {
      try {
        const gfa = await decodeBlob(blob as Blob, compressed)
        const graph = loadGraph(gfa, fileName, { maxNodes: MAX_NODES })
        const { result } = await forceLayout(
          graph,
          ENGINE_DEFAULTS,
          layoutEngine,
        )
        return { graph, layout: result }
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Could not draw this GFA file.",
        }
      }
    },
  })

  const rendered = useMemo(() => {
    if ("error" in figure || size.width < 1 || size.height < 1) {
      return null
    }
    return parseFigure(
      figureSvg(figure.graph, figure.layout, {
        width: Math.round(size.width),
        height: Math.round(size.height),
      }),
    )
  }, [figure, size.width, size.height])

  const imageUrl = useMemo(
    () =>
      rendered
        ? URL.createObjectURL(
            new Blob([rendered.svg], { type: "image/svg+xml" }),
          )
        : null,
    [rendered],
  )

  useEffect(
    () => () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    },
    [imageUrl],
  )

  const fitted = useMemo<ViewTransform>(() => {
    if (!rendered || size.width < 1 || size.height < 1) {
      return { scale: 1, x: 0, y: 0 }
    }
    const scale = Math.min(
      size.width / rendered.width,
      size.height / rendered.height,
    )
    return {
      scale,
      x: (size.width - rendered.width * scale) / 2,
      y: (size.height - rendered.height * scale) / 2,
    }
  }, [rendered, size.width, size.height])

  useEffect(() => {
    setView(fitted)
  }, [fitted])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    const measure = () => {
      setSize({
        width: container.clientWidth,
        height: container.clientHeight,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = container.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      setView((current) => {
        const scale = Math.min(
          40,
          Math.max(0.05, current.scale * Math.exp(-event.deltaY * 0.0015)),
        )
        const ratio = scale / current.scale
        return {
          scale,
          x: pointerX - (pointerX - current.x) * ratio,
          y: pointerY - (pointerY - current.y) * ratio,
        }
      })
    }
    container.addEventListener("wheel", onWheel, { passive: false })
    return () => container.removeEventListener("wheel", onWheel)
  }, [])

  const hitTest = useMemo(() => {
    if (!rendered || "error" in figure) {
      return undefined
    }
    const pixelRows = figure.layout.pixelRows ?? false
    const fit = fitTransform(
      drawingBounds(figure.layout),
      rendered.drawingWidth,
      rendered.drawingHeight,
      pixelRows,
      { padLeft: FIT_PADDING },
    )
    if (!fit) {
      return undefined
    }
    const nodeById = new Map(figure.graph.nodes.map((node) => [node.id, node]))
    return {
      fit,
      axis: axisScaleOf(fit.scale, pixelRows),
      nodeById,
    }
  }, [figure, rendered])

  const hoverAt = (clientX: number, clientY: number): Hover | null => {
    const image = imageRef.current
    const container = containerRef.current
    if (!rendered || !hitTest || !image || !container || "error" in figure) {
      return null
    }
    const rect = image.getBoundingClientRect()
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null
    }
    const svgX = ((clientX - rect.left) / rect.width) * rendered.width
    const svgY = ((clientY - rect.top) / rect.height) * rendered.height
    const point = screenToLayout(
      svgX,
      svgY - rendered.drawingY,
      hitTest.fit,
      hitTest.axis,
    )
    const ink = nodeInk(
      figure.graph,
      hitTest.nodeById,
      NODE_THICKNESS,
      NODE_WIDTH,
    )
    const nodeId = findHoveredNode(
      figure.layout.nodePositions,
      point.x,
      point.y,
      hitTest.axis,
      0,
      ink,
      undefined,
    )
    const node = nodeId ? hitTest.nodeById.get(nodeId) : undefined
    if (!node) {
      return null
    }
    const containerRect = container.getBoundingClientRect()
    return {
      name: node.name,
      length: node.length,
      depth: node.depth,
      x: clientX - containerRect.left,
      y: clientY - containerRect.top,
    }
  }

  const exportSvg = () => {
    if (!rendered) {
      return
    }
    const url = URL.createObjectURL(
      new Blob([rendered.svg], { type: "image/svg+xml" }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = `${fileName.replace(/\.gfa(\.gz)?$/i, "") || "graph"}.svg`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }
    dragRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    setHover(null)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (drag) {
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      dragRef.current = { x: event.clientX, y: event.clientY }
      setView((current) => ({
        ...current,
        x: current.x + dx,
        y: current.y + dy,
      }))
      return
    }
    setHover(hoverAt(event.clientX, event.clientY))
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  if ("error" in figure) {
    return <p className="italic text-gray-500">{figure.error}</p>
  }

  return (
    <div>
      <div
        ref={containerRef}
        role="application"
        aria-label="GFA graph viewer"
        className="relative h-[70vh] min-h-[320px] w-full touch-none overflow-hidden rounded-t-md border border-b-0 bg-white"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          if (!dragRef.current) {
            setHover(null)
          }
        }}
        onDoubleClick={() => setView(fitted)}
      >
        {imageUrl && rendered && (
          <img
            ref={imageRef}
            src={imageUrl}
            width={rendered.width}
            height={rendered.height}
            alt={`BandageJS drawing of ${fileName}`}
            draggable={false}
            className="block origin-top-left cursor-grab select-none"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
          />
        )}
        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded border bg-background/95 px-2 py-1 text-xs shadow"
            style={{ left: hover.x + 12, top: hover.y + 12 }}
          >
            <div className="font-medium">{hover.name}</div>
            <div className="text-muted-foreground">
              {hover.length.toLocaleString()} bp · depth {hover.depth}
            </div>
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-2">
          <button
            type="button"
            onClick={exportSvg}
            onPointerDown={(event) => event.stopPropagation()}
            className="rounded border bg-background/95 px-2 py-1 text-xs shadow hover:bg-accent"
          >
            Export SVG
          </button>
          <button
            type="button"
            onClick={() => setView(fitted)}
            onPointerDown={(event) => event.stopPropagation()}
            className="rounded border bg-background/95 px-2 py-1 text-xs shadow hover:bg-accent"
          >
            Fit
          </button>
        </div>
        <div className="pointer-events-none absolute bottom-2 left-2 text-gray-500 text-xs">
          Drag to pan · scroll to zoom · double-click to fit
        </div>
      </div>
      <div className="flex items-center justify-between rounded-b-md border px-2 py-1 text-muted-foreground text-xs">
        <span>
          {figure.graph.nodes.length.toLocaleString()} nodes ·{" "}
          {figure.graph.edges.length.toLocaleString()} edges
        </span>
        <a
          href="https://github.com/GMOD/BandageJS"
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          Rendered with BandageJS
        </a>
      </div>
    </div>
  )
}

export default GfaFile
