import { useCallback, useEffect, useRef, useState } from "react"
import { WebsocketsService } from "../client"

export interface UseWebSocketOptions {
  protocols?: string | string[]
  auth?: boolean
  /** A caller that supplies its own stream leaves the socket closed. */
  enabled?: boolean
  onOpen?: (event: Event) => void
  onMessage?: (event: MessageEvent) => void
  onError?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
}

export const useWebSocket = (
  channel: string,
  {
    protocols,
    auth = true,
    enabled = true,
    onOpen,
    onMessage,
    onError,
    onClose,
  }: UseWebSocketOptions = {},
) => {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Store callbacks in a ref so that changes to them don't trigger a reconnect.
  const callbacksRef = useRef({ onOpen, onMessage, onError, onClose })

  // Update the callbacks ref when any callback changes.
  useEffect(() => {
    callbacksRef.current = { onOpen, onMessage, onError, onClose }
  }, [onOpen, onMessage, onError, onClose])

  const connect = useCallback(() => {
    // Clear any pending reconnect timer.
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    // Close any existing connection.
    if (wsRef.current) {
      wsRef.current.close()
    }

    const openSocket = (wsToken?: string) => {
      const baseURL = import.meta.env.VITE_API_URL || window.location.origin
      const wsUrl = new URL(`/api/v1/websockets/${channel}`, baseURL)
      wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:"
      // Authenticated sockets carry a short-lived, socket-scoped token minted
      // with the REST bearer token (POST /api/v1/websockets/token): the
      // long-lived login JWT never appears in a socket URL.
      if (wsToken) wsUrl.searchParams.set("token", wsToken)
      const ws = new WebSocket(wsUrl, protocols)
      wsRef.current = ws

      ws.onopen = (event) => {
        setIsConnected(true)
        callbacksRef.current.onOpen?.(event)
      }

      ws.onmessage = (event) => {
        callbacksRef.current.onMessage?.(event)
      }

      ws.onerror = (event) => {
        setIsConnected(false)
        callbacksRef.current.onError?.(event)
      }

      ws.onclose = (event) => {
        setIsConnected(false)
        callbacksRef.current.onClose?.(event)
      }
    }

    if (!auth) {
      // The public event stream is anonymous.
      openSocket()
      return
    }
    // Mint a fresh WS token per connection attempt; the backend rejects any
    // socket whose token expired (default 120s).
    WebsocketsService.createWsToken()
      .then(({ data }) => {
        openSocket(data?.access_token)
      })
      .catch(() => {
        // No session: falling back to a token-less socket mirrors the old
        // behaviour and lets the server close it, so callers see onClose.
        setIsConnected(false)
        openSocket()
      })
  }, [auth, channel, protocols])

  useEffect(() => {
    if (!enabled) return
    const connectTimer = window.setTimeout(connect, 0)
    // Clean up on unmount.
    return () => {
      clearTimeout(connectTimer)
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current)
      }
    }
  }, [connect, enabled])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
    }
  }, [])

  return { ws: wsRef.current, isConnected, reconnect: connect, disconnect }
}

export default useWebSocket
