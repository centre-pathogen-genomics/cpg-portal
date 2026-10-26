import type { Ref } from "react"
import { useEffect, useImperativeHandle, useRef } from "react"

/**
 * Cloudflare Turnstile, to keep automated signups and bots out.
 *
 * Only renders when `VITE_TURNSTILE_SITE_KEY` is supplied, and it pairs with
 * the backend's `TURNSTILE_SECRET_KEY` and `TURNSTILE_ACTION`: a deployment
 * with no keys behaves as it did before. The token it produces is redeemed
 * once, so a caller that stays on the page calls `reset()` before a retry.
 */
const SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ""
const ACTION: string = import.meta.env.VITE_TURNSTILE_ACTION ?? "signup"
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export type TurnstileHandle = { reset: () => void }

/** Whether this deployment asks visitors to prove they are human. */
export const turnstileEnabled = SITE_KEY !== ""

const waiting: Array<() => void> = []
let loading = false

/** The widget script is fetched once; every mount renders when it arrives. */
function whenTurnstileReady(callback: () => void): void {
  if (window.turnstile) {
    callback()
    return
  }
  waiting.push(callback)
  if (loading) return

  loading = true
  const script = document.createElement("script")
  script.src = SCRIPT_SRC
  script.async = true
  script.defer = true
  script.onload = () => {
    for (const render of waiting.splice(0)) render()
  }
  script.onerror = () => {
    // Signups then fail on the server, which is the safe way round.
    waiting.length = 0
  }
  document.head.appendChild(script)
}

export default function Turnstile({
  ref,
  onToken,
}: {
  ref?: Ref<TurnstileHandle>
  onToken: (token: string | null) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  // The widget outlives a render, so it calls the latest callback.
  const handleToken = useRef(onToken)
  handleToken.current = onToken

  useImperativeHandle(
    ref,
    () => ({
      // Every token is good for one request, so a retry needs a fresh one.
      reset: () => {
        if (widgetId.current && window.turnstile) {
          window.turnstile.reset(widgetId.current)
        }
      },
    }),
    [],
  )

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false

    whenTurnstileReady(() => {
      if (cancelled || !container.current || !window.turnstile) return
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: SITE_KEY,
        // Cloudflare hands this back for the backend to check.
        action: ACTION,
        callback: (token: string) => handleToken.current(token),
        "expired-callback": () => handleToken.current(null),
        "error-callback": () => handleToken.current(null),
      })
    })

    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = null
      }
    }
  }, [])

  if (!SITE_KEY) return null
  return <div ref={container} className="flex justify-center" />
}
