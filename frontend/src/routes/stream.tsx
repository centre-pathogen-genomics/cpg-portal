import { useMemo, useRef, useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AppProvider } from '@pixi/react';
import { ErrorBoundary } from 'react-error-boundary';
import { Box, Text, Image, Icon } from '@chakra-ui/react';
import * as PIXI from 'pixi.js';
import EventStreamVisualizationPixi, { EventStreamVisualizationRef } from '../components/EventStream/EventStreamVisualizationPixi';
import ErrorLogo from '/assets/images/500.png';
import { HiOutlineStatusOffline } from "react-icons/hi";

export const Route = createFileRoute('/stream')({
  component: Stream,
});

function Stream() {
  const eventStreamRef = useRef<EventStreamVisualizationRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(true);
  
  // Create PIXI.Application only once.
  const app = useMemo(() => {
    return new PIXI.Application({
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio,
    });
  }, []);

  // Track dimensions based on the parent container.
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

    updateSize(); // Initial measurement
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [app]);

  // Add some default events.
  useEffect(() => {
    [3, 3, 7, 10].forEach(size => {
      eventStreamRef.current?.addEvent({
        name: 'CPG Portal',
        size: size,
      });
    });
  }, []);

  // Create a ref to hold the WebSocket instance.
  const wsRef = useRef<WebSocket | null>(null);

  // Function to connect (or reconnect) the WebSocket.
  const connectWebSocket = () => {
    // Close existing connection if any.
    if (wsRef.current) {
      wsRef.current.close();
    }

    const baseURL = import.meta.env.VITE_API_URL;
    const wsUrl = baseURL.replace('http', 'ws') + '/api/v1/websockets/stream';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to WebSocket at", wsUrl);
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Expected message format: { toolname: "ToolName", param_count: number }
        if (data.toolname && typeof data.param_count === 'number') {
          eventStreamRef.current?.addEvent({
            name: data.toolname,
            size: data.param_count + 1,
          });
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.error("WebSocket disconnected");
      setIsConnected(false);
    };
  };

  // Connect on mount and clean up on unmount.
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // attempt to reconnect every 5 seconds when disconnected
  useEffect(() => {
    if (!isConnected) {
      const interval = setInterval(() => {
        console.log("Attempting to reconnect WebSocket...");
        connectWebSocket();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);
  

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
          position={'relative'}
        >
          <EventStreamVisualizationPixi
            ref={eventStreamRef}
            width={dimensions.width}
            height={dimensions.height}
          />
          {/* When disconnected, show an icon that on click attempts to reconnect */}
          {!isConnected && (
            <Icon
              as={HiOutlineStatusOffline}
              position="absolute"
              bottom={0}
              right={0}
              m={2}
              boxSize={8}
              color="red.500"
              onClick={connectWebSocket}  // Clicking the icon triggers a reconnect
              cursor="pointer"            // Change cursor to indicate it's clickable
              title="Click to reconnect"
            />
          )}
        </Box>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default Stream;
