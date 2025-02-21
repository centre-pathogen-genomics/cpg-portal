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
  // Ref to the container element that wraps our Stage.
  const containerRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(true);
  
  // Create the PIXI.Application instance once.
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

  // Update dimensions on resize using the parent container's size.
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

  useEffect(() => {
    // add default event
    [3, 3, 7, 10].forEach(size => {
      eventStreamRef.current?.addEvent({
        name: 'CPG Portal',
        size: size,
      });
    });
  }, []);

  // Connect to the WebSocket endpoint and add events when messages are received.
  useEffect(() => {
    const baseURL = import.meta.env.VITE_API_URL
    const wsUrl = baseURL.replace('http', 'ws') + '/api/v1/websockets/stream';
    const ws = new WebSocket(wsUrl);

    

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

    return () => ws.close();
  }, []);

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
          {!isConnected && (
            <Icon as={HiOutlineStatusOffline} position={'absolute'} bottom={0} right={0} m={2} boxSize={8} color={'red.500'}/>
            )}
          </Box>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default Stream;
