export function fileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath
}

export function extensionOf(filePath: string): string {
  const name = fileName(filePath).toLowerCase()
  const dot = name.lastIndexOf(".")
  return dot >= 0 ? name.slice(dot) : ""
}
