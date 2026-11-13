export const humanReadableFileSize = (bytes: number) => {
  if (bytes === 0) {
    return "0 B"
  }
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(0)} ${["B", "kB", "MB", "GB", "TB"][i]}`
}

export function fileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath
}

export function extensionOf(filePath: string): string {
  const name = fileName(filePath).toLowerCase()
  const dot = name.lastIndexOf(".")
  return dot >= 0 ? name.slice(dot) : ""
}
