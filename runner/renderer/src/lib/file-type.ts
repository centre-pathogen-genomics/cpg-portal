import type { FileTypesMap } from "../contracts"

/**
 * The backend's extension table (`backend/app/core/file_types.py`), as the
 * sidecar serves it at `/api/file-types`. Longest match wins; `"unknown"` when
 * nothing matches.
 */
export function fileTypeOf(name: string, fileTypes: FileTypesMap): string {
  const lowered = name.toLowerCase()
  let best = "unknown"
  let bestLength = 0
  for (const [type, meta] of Object.entries(fileTypes)) {
    for (const extension of meta.extensions) {
      const ext = extension.toLowerCase()
      if (lowered.endsWith(ext) && ext.length > bestLength) {
        best = type
        bestLength = ext.length
      }
    }
  }
  return best
}
