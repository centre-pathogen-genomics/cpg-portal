import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { HiOutlineStatusOffline } from "react-icons/hi"
import { MdFullscreen, MdFullscreenExit } from "react-icons/md"
import { Button } from "@/components/ui/button"
import ErrorLogo from "/assets/images/500.png"
import IconLogo from "/assets/images/cpg-logo-icon.png"
import IconLogoTransparent from "/assets/images/cpg-logo-icon-transparent.png"
import EventStreamVisualizationPixi, {
  type EventStreamVisualizationRef,
} from "../components/EventStream/EventStreamVisualizationPixi"
import useWebSocket from "../hooks/useWebsocket"

export const Route = createFileRoute("/stream")({
  component: Stream,
})

function Stream() {
  const eventStreamRef = useRef<EventStreamVisualizationRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track container dimensions.
  const [dimensions, setDimensions] = useState<{
    width: number
    height: number
  }>({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  // Track the available canvas size.
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current
        setDimensions({ width: clientWidth, height: clientHeight })
      }
    }

    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  // Add some default events.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const seedEvents = () => {
      if (!eventStreamRef.current) {
        timer = setTimeout(seedEvents, 100)
        return
      }
      ;[3, 3, 7, 10].forEach((size) => {
        eventStreamRef.current?.addEvent({
          size,
          image: IconLogo,
        })
      })
    }
    seedEvents()
    return () => clearTimeout(timer)
  }, [])

  // Use the useWebSocket hook to manage the WebSocket connection.
  const { reconnect, isConnected } = useWebSocket("stream", {
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data)
        // Expected message format: { toolname: "ToolName", param_count: number }
        if (data.toolname && typeof data.param_count === "number") {
          eventStreamRef.current?.addEvent({
            name: data.toolname,
            size: data.param_count + 1,
            image: IconLogoTransparent,
          })
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err)
      }
    },
  })

  // Attempt to reconnect every 5 seconds when disconnected.
  useEffect(() => {
    if (!isConnected) {
      const interval = setInterval(() => {
        console.log("Attempting to reconnect WebSocket...")
        reconnect()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [isConnected, reconnect])

  // Handler for entering full screen mode.
  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen()
    }
  }

  return (
    <ErrorBoundary
      fallbackRender={() => (
        <div className="mt-8 flex w-full flex-col items-center justify-center text-center">
          <p>Something went wrong... Please reload the page!</p>
          <img src={ErrorLogo} alt="Error" />
        </div>
      )}
    >
      <div
        id="frame"
        ref={containerRef}
        className="relative m-0 block h-full w-full overflow-hidden"
      >
        {/* Fullscreen Icon Button positioned at the top-right */}
        <Button
          aria-label="Enter Fullscreen"
          className="absolute top-4 right-4 z-[1]"
          size="icon"
          onClick={handleFullscreen}
          variant="ghost"
        >
          {document.fullscreenElement ? <MdFullscreenExit /> : <MdFullscreen />}
        </Button>

        <EventStreamVisualizationPixi
          ref={eventStreamRef}
          width={dimensions.width}
          height={dimensions.height}
        />
        {/* When disconnected, show an icon that allows manual reconnection if desired */}
        {!isConnected && (
          <HiOutlineStatusOffline
            className="absolute right-0 bottom-0 m-2 size-8 cursor-pointer text-red-500"
            onClick={() => {
              reconnect()
            }}
            title="Click to reconnect"
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

export default Stream
