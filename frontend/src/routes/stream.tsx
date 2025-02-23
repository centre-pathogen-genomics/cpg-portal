import { useMemo, useRef, useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AppProvider } from '@pixi/react';
import { ErrorBoundary } from 'react-error-boundary';
import { Box, Text, Image, Icon, IconButton } from '@chakra-ui/react';
import * as PIXI from 'pixi.js';
import EventStreamVisualizationPixi, { EventStreamVisualizationRef } from '../components/EventStream/EventStreamVisualizationPixi';
import ErrorLogo from '/assets/images/500.png';
import { HiOutlineStatusOffline } from "react-icons/hi";
import { MdFullscreen, MdFullscreenExit } from "react-icons/md";
import IconLogo from "/assets/images/cpg-logo-icon.png";
import IconLogoTransparent from "/assets/images/cpg-logo-icon-transparent.png";
import useWebSocket from '../hooks/useWebsocket';

export const Route = createFileRoute('/stream')({
  component: Stream,
});

function Stream() {
  const eventStreamRef = useRef<EventStreamVisualizationRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Create PIXI.Application only once.
  const app = useMemo(
    () =>
      new PIXI.Application({
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio,
      }),
    []
  );

  // Track container dimensions.
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Resize the PIXI renderer when the container size changes.
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        app.renderer.resize(clientWidth, clientHeight);
        setDimensions({ width: clientWidth, height: clientHeight });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [app]);

  // Add some default events.
  useEffect(() => {
    [3, 3, 7, 10].forEach((size) => {
      eventStreamRef.current?.addEvent({
        size,
        image: IconLogo,
      });
    });
  }, []);

  // Use the useWebSocket hook to manage the WebSocket connection.
  const {reconnect, isConnected} = useWebSocket('stream', {
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        // Expected message format: { toolname: "ToolName", param_count: number }
        if (data.toolname && typeof data.param_count === 'number') {
          eventStreamRef.current?.addEvent({
            name: data.toolname,
            size: data.param_count + 1,
            image: IconLogoTransparent,
          });
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    },
  });

  // Attempt to reconnect every 5 seconds when disconnected.
  useEffect(() => {
    if (!isConnected) {
      const interval = setInterval(() => {
        console.log("Attempting to reconnect WebSocket...");
        reconnect();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);


  // Handler for entering full screen mode.
  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (containerRef.current && containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen();
    }
  };

  return (
    <ErrorBoundary
      fallbackRender={() => (
        <Box textAlign="center" mt={8} w="100%" justifyContent="center" alignItems="center">
          <Text>Something went wrong... Please reload the page!</Text>
          <Image src={ErrorLogo} alt="Error" />
        </Box>
      )}
    >
      <AppProvider value={app}>
        <Box
          id="frame"
          ref={containerRef}
          width="100%"
          height="100%"
          overflow="hidden"
          sx={{ display: 'block' }}
          margin={0}
          position="relative"
        >
          {/* Fullscreen Icon Button positioned at the top-right */}
          <IconButton
            aria-label="Enter Fullscreen"
            icon={document.fullscreenElement ? <MdFullscreenExit /> : <MdFullscreen />}
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
                reconnect();
              }}
              cursor="pointer"
              title="Click to reconnect"
            />
          )}
        </Box>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default Stream;
