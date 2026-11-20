import { useEffect, useState } from "react"
import type { RunPublic } from "../client"
import useWebSocket from "./useWebsocket"

const normalizeLogs = (value: string | null | undefined) =>
  value ? value.replace(/\n+$/g, "") : ""

const appendLog = (previous: string, line: string) => {
  const normalized = normalizeLogs(previous)
  return normalized ? `${normalized}\n${line}` : line
}

/**
 * One live log stream per run page. The timeline and the log viewer read the
 * same state, so opening a run only holds one WebSocket for its logs.
 */
const useRunLogs = (run: RunPublic) => {
  const [logs, setLogs] = useState(() => normalizeLogs(run.stdout))
  const [status, setStatus] = useState(run.status)

  useEffect(() => {
    setStatus(run.status)
    setLogs((previous) => {
      const next = normalizeLogs(run.stdout)
      return next.length >= previous.length ? next : previous
    })
  }, [run.status, run.stdout])

  useWebSocket(`logs/${run.id}`, {
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data)
        if (typeof data.status === "string") setStatus(data.status)
        if (typeof data.stdout === "string") {
          setLogs((previous) => {
            const next = normalizeLogs(data.stdout)
            return next.length >= previous.length ? next : previous
          })
        }
        if (typeof data.log === "string")
          setLogs((previous) => appendLog(previous, data.log))
      } catch (error) {
        console.error("Error parsing WebSocket message:", error)
      }
    },
  })

  return { logs, status }
}

export default useRunLogs
