/**
 * drive-relay-sw.js — root-scoped service worker for the CPG portal.
 *
 * Why this exists
 * --------------
 * The JupyterLite R kernel (webR 0.6.0) mounts an Emscripten DRIVEFS at /drive.
 * Every filesystem operation is a synchronous POST to `<origin>/api/drive`
 * (the path is hard-coded in the webR worker as `location.origin + "/"`),
 * plus stdin via `/api/stdin/`. These requests are meant to be intercepted by
 * a service worker and answered by the JupyterLite page that owns the kernel:
 * files are served straight from the page's own storage (the JupyterLite
 * drive) over a BroadcastChannel — no HTTP request ever leaves the browser.
 *
 * JupyterLite's own service worker (served at
 * /wasm/jupyterlite/service-worker.js) implements exactly this protocol, but
 * it can only intercept requests once it controls the page. In this
 * deployment a *first ever* visit (fresh origin, or after a JupyterLite
 * app-version bump that unregisters all workers) loads the page before any
 * service worker controls it, and the JupyterLite worker's activation/claim
 * does not land on that page — so every /api/drive request falls through to
 * the server and returns 404. A reload fixes it, which is a poor first-run
 * experience and the reported bug.
 *
 * What this worker does
 * ---------------------
 * Registered from the portal app (frontend/src/main.tsx) with the default
 * root scope ("/" — this file lives at the origin root), it is active before
 * the user opens the JupyterLite tab. That tab is therefore controlled from
 * document start, so its kernel's DRIVEFS and stdin requests are always
 * intercepted — on the first visit too. It relays those requests to the
 * JupyterLite page over the same BroadcastChannel protocol JupyterLite uses
 * (sw-api.v1), keyed by browsingContextId, and returns the page's answer.
 * Everything else is passed through untouched (no caching, no claim of any
 * page that is already controlled by a more specific worker).
 *
 * The JupyterLite service worker remains in place and handles the steady
 * state (subsequent visits, where it controls the page directly); this relay
 * only guarantees that the first visit works as well.
 */
"use strict"

const BROADCAST_CHANNEL = "/sw-api.v1"
const BROADCAST_PATH_MARKERS = ["/api/drive", "/api/stdin/"]
const RELAY_TIMEOUT_MS = 30_000

self.addEventListener("install", () => {
  // Activate immediately so the relay is controlling before the user opens
  // the JupyterLite tab.
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  // Claim pages that are already open *and not otherwise controlled* (e.g.
  // a portal tab). Pages already controlled by a more specific worker — the
  // JupyterLite service worker on /wasm/jupyterlite/ — stay with that worker;
  // the browser gives control to the longest matching scope anyway.
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Only handle same-origin requests; anything else goes to the network.
  if (url.origin !== self.location.origin) return

  if (url.pathname === "/api/service-worker-heartbeat") {
    event.respondWith(new Response("ok"))
    return
  }

  if (BROADCAST_PATH_MARKERS.some((marker) => url.pathname.includes(marker))) {
    event.respondWith(relayToPage(event.request, url))
    return
  }

  // Plain pass-through for everything else. No cache is ever used.
})

/**
 * Forward a DRIVEFS/stdin request to the JupyterLite page and return its
 * answer. Mirrors broadcastOne() in JupyterLite's service-worker.js:
 *   - parse the request body {data, browsingContextId}
 *   - post {data, browsingContextId, pathname} on the sw-api.v1 channel
 *   - wait for a reply {response, browsingContextId} with a matching id
 * A timeout guards against a stale or closed JupyterLite page, where the
 * upstream worker would otherwise hang the kernel's synchronous request.
 */
async function relayToPage(request, url) {
  let body
  try {
    body = await request.json()
  } catch {
    return new Response('{"error":"invalid JSON body"}', { status: 400 })
  }

  const channel = new BroadcastChannel(BROADCAST_CHANNEL)
  try {
    return await new Promise((resolve) => {
      const timer = setTimeout(() => {
        channel.close()
        resolve(
          new Response('{"error":"drive relay timed out"}', { status: 504 }),
        )
      }, RELAY_TIMEOUT_MS)

      const onMessage = (event) => {
        const { browsingContextId, response } = event.data ?? {}
        if (browsingContextId !== body.browsingContextId) return
        clearTimeout(timer)
        channel.removeEventListener("message", onMessage)
        channel.close()
        resolve(new Response(JSON.stringify(response)))
      }

      channel.addEventListener("message", onMessage)
      channel.postMessage({ ...body, pathname: url.pathname })
    })
  } finally {
    // BroadcastChannel is closed in both paths above; nothing to do here.
  }
}