import { Box, Icon, IconButton, Image, Text } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { HiOutlineStatusOffline } from "react-icons/hi"
import { MdFullscreen, MdFullscreenExit } from "react-icons/md"
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
        <Box
          textAlign="center"
          mt={8}
          w="100%"
          justifyContent="center"
          alignItems="center"
        >
          <Text>Something went wrong... Please reload the page!</Text>
          <Image src={ErrorLogo} alt="Error" />
        </Box>
      )}
    >
      <Box
        id="frame"
        ref={containerRef}
        width="100%"
        height="100%"
        overflow="hidden"
        sx={{ display: "block" }}
        margin={0}
        position="relative"
      >
        {/* Fullscreen Icon Button positioned at the top-right */}
        <IconButton
          aria-label="Enter Fullscreen"
          icon={
            document.fullscreenElement ? <MdFullscreenExit /> : <MdFullscreen />
          }
          position="absolute"
          top="1rem"
          right="1rem"
          onClick={handleFullscreen}
          zIndex={1}
          variant="ghost"
        />

        <EventStreamVisualizationPixi
          ref={eventStreamRef}
          width={dimensions.width}
          height={dimensions.height}
        />
        {/* When disconnected, show an icon that allows manual reconnection if desired */}
        {!isConnected && (
          <Icon
            as={HiOutlineStatusOffline}
            position="absolute"
            bottom={0}
            right={0}
            m={2}
            boxSize={8}
            color="red.500"
            onClick={() => {
              reconnect()
            }}
            cursor="pointer"
            title="Click to reconnect"
          />
        )}
      </Box>
    </ErrorBoundary>
  )
}

export default Stream
