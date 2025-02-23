import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseWebSocketOptions {
  protocols?: string | string[];
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
}

export const useWebSocket = (
  channel: string,
  {
    protocols,
    onOpen,
    onMessage,
    onError,
    onClose,
  }: UseWebSocketOptions = {}
) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Store callbacks in a ref so that changes to them don't trigger a reconnect.
  const callbacksRef = useRef({
    onOpen,
    onMessage,
    onError,
    onClose,
  });

  // Update the callbacks ref when any callback changes.
  useEffect(() => {
    callbacksRef.current = { onOpen, onMessage, onError, onClose };
  }, [onOpen, onMessage, onError, onClose]);

  const connect = useCallback(() => {
    // Clear any pending reconnect timer.
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    // Close any existing connection.
    if (wsRef.current) {
      wsRef.current.close();
    }
    const baseURL = import.meta.env.VITE_API_URL;
    const token = localStorage.getItem("access_token");
    const wsUrl = baseURL.replace('http', 'ws') + `/api/v1/websockets/` + channel + `?token=${token}`;
    const ws = new WebSocket(wsUrl, protocols);
    wsRef.current = ws;

    ws.onopen = (event) => {
      setIsConnected(true);
      callbacksRef.current.onOpen && callbacksRef.current.onOpen(event);
    };

    ws.onmessage = (event) => {
      callbacksRef.current.onMessage && callbacksRef.current.onMessage(event);
    };

    ws.onerror = (event) => {
      setIsConnected(false);
      callbacksRef.current.onError && callbacksRef.current.onError(event);
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      callbacksRef.current.onClose && callbacksRef.current.onClose(event);
    };
  }, [channel, protocols]);

  useEffect(() => {
    connect();
    // Clean up on unmount.
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
  }, []);

  return { ws: wsRef.current, isConnected, reconnect: connect, disconnect };
};

export default useWebSocket;
