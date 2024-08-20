import { useEffect, useState } from "react"
import type { TaskPublic } from "../../client"

// Component that displays the runtime of a task, handling UTC time
const TaskRuntime = ({ task }: { task: TaskPublic }) => {
  const [runtime, setRuntime] = useState("...")

  useEffect(() => {
    if (!task.started_at) {
      setRuntime("...")
      return
    }

    // Initialize start time from UTC string
    const start = new Date(`${task.started_at}Z`) // Ensure UTC by appending 'Z' if not already present

    let intervalId: NodeJS.Timeout | null = null

    const updateRuntime = () => {
      let end: Date
      if (task.finished_at) {
        end = new Date(`${task.finished_at}Z`) // Parse finished_at as UTC
      } else if (task.status === "running") {
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

      const diff = end.getTime() - start.getTime() // Difference in milliseconds
      const hours = Math.floor(diff / 3600000) // Convert milliseconds to hours
      const minutes = Math.floor((diff % 3600000) / 60000) // Remaining minutes
      const seconds = Math.floor((diff % 60000) / 1000) // Remaining seconds
      setRuntime(`${hours}h ${minutes}m ${seconds}s`)
    }

    // Update runtime immediately and set an interval if the task is running
    updateRuntime()
    if (task.status === "running") {
      intervalId = setInterval(updateRuntime, 1000)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId) // Clear interval on component unmount
      }
    }
  }, [task.started_at, task.finished_at, task.status]) // Dependencies for effect

  return <span>{runtime}</span>
}

export default TaskRuntime
