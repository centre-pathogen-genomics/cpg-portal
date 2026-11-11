let sessionToken = ""
// Development serves the UI from vite while the API stays on the sidecar, so
// the window is told where the API is. Same origin otherwise.
let apiBase = ""
const baseListeners = new Set<() => void>()

/** Notified when the window is pointed at another tool's runner. */
export function onApiBaseChange(listener: () => void): () => void {
  baseListeners.add(listener)
  return () => {
    baseListeners.delete(listener)
  }
}

export function setApiBase(value: string | null): void {
  apiBase = (value ?? "").replace(/\/+$/, "")
  for (const listener of baseListeners) listener()
}

function apiRoot(): string {
  return apiBase || window.location.origin
}

export function setSessionToken(value: string | null): void {
  sessionToken = value ?? ""
}

export function getToken(): string {
  return window.cpgRunner?.token || sessionToken
}

export class ApiError extends Error {
  readonly status: number
  readonly detail: string
  readonly payload: unknown

  constructor(status: number, detail: string, payload: unknown) {
    super(detail)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
    this.payload = payload
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail
  if (error instanceof Error) return error.message
  return String(error)
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const detailValue = (payload as { detail?: unknown } | null)?.detail
  const detail =
    typeof detailValue === "string"
      ? detailValue
      : detailValue
        ? JSON.stringify(detailValue)
        : `${response.status} ${response.statusText}`
  return new ApiError(response.status, detail, payload)
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${apiBase}/api${path}`, {
    method,
    headers: {
      "X-CPG-Token": getToken(),
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

function socketUrl(path: string): string {
  const url = new URL(`/api${path}`, `${apiRoot()}/`)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.searchParams.set("token", getToken())
  return url.toString()
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  async blob(path: string): Promise<Blob> {
    const response = await fetch(`${apiBase}/api${path}`, {
      headers: { "X-CPG-Token": getToken() },
    })
    if (!response.ok) throw await toApiError(response)
    return response.blob()
  },
  wsUrl: socketUrl,
  doctorEventsUrl: () => socketUrl("/doctor/events"),
}
