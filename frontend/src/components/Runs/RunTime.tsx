import { useEffect, useState } from "react"

interface RunRuntimeProps {
  finished_at: string | null
  started_at: string | null
  status: string
}

// The portal stores naive UTC (`2026-01-01T10:00:00`), the desktop sidecar
// stores a zoned ISO string. Both have to read as the same instant.
const parseTimestamp = (value: string): Date =>
  new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`)

// Component that displays the runtime of a run, handling UTC time
const RunRuntime = ({ started_at, finished_at, status }: RunRuntimeProps) => {
  const [runtime, setRuntime] = useState("...")

  useEffect(() => {
    if (!started_at) {
      setRuntime("...")
      return
    }

    // Initialize start time from UTC string
    const start = parseTimestamp(started_at)

    let intervalId: NodeJS.Timeout | null = null

    const updateRuntime = () => {
      let end: Date
      if (finished_at) {
        end = parseTimestamp(finished_at)
      } else if (status === "running") {
        end = new Date() // Create a Date object for the current time
        end = new Date(
          Date.UTC(
            end.getUTCFullYear(),
            end.getUTCMonth(),
            end.getUTCDate(),
            end.getUTCHours(),
            end.getUTCMinutes(),
            end.getUTCSeconds(),
          ),
        ) // Convert to UTC
      } else {
        setRuntime("...")
        return
      }

      // `end` is truncated to whole seconds while a run is going, so it can sit
      // a moment before `start`; a negative span would print as "-1h -1m -1s".
      const diff = Math.max(0, end.getTime() - start.getTime())
      const hours = Math.floor(diff / 3600000) // Convert milliseconds to hours
      const minutes = Math.floor((diff % 3600000) / 60000) // Remaining minutes
      const seconds = Math.floor((diff % 60000) / 1000) // Remaining seconds
      setRuntime(`${hours}h ${minutes}m ${seconds}s`)
    }

    // Update runtime immediately and set an interval if the run is running
    updateRuntime()
    if (status === "running") {
      intervalId = setInterval(updateRuntime, 1000)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId) // Clear interval on component unmount
      }
    }
  }, [started_at, finished_at, status]) // Dependencies for effect

  return <span>{runtime}</span>
}

export default RunRuntime
