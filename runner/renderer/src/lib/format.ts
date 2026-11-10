export function fileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath
}

export function extensionOf(filePath: string): string {
  const name = fileName(filePath).toLowerCase()
  const dot = name.lastIndexOf(".")
  return dot >= 0 ? name.slice(dot) : ""
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(
      seconds,
    ).padStart(2, "0")}s`
  }
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`
}
