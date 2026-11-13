import { useSuspenseQuery } from "@tanstack/react-query"
import {
  createContext,
  type JSX,
  type ReactNode,
  useContext,
  useRef,
} from "react"

/** What a renderer needs to know about the file it draws. */
export type RenderableFile = {
  /** Cache identity, unique within the viewer, e.g. a file id or an output index. */
  key: string
  name: string
  file_type?: string | null
  size?: number | null
  is_group?: boolean
}

/** Where the bytes of a file come from: the host app decides. */
export type FileLoader = (file: RenderableFile) => Promise<Blob>

const FileLoaderContext = createContext<FileLoader | null>(null)

export function FileLoaderProvider(props: {
  loader: FileLoader
  children: ReactNode
}): JSX.Element {
  return (
    <FileLoaderContext.Provider value={props.loader}>
      {props.children}
    </FileLoaderContext.Provider>
  )
}

function useFileLoader(): FileLoader {
  const loader = useContext(FileLoaderContext)
  if (!loader) {
    throw new Error(
      "FileRenderer needs a FileLoaderProvider: the host app must say where file bytes come from.",
    )
  }
  return loader
}

/**
 * The file's bytes, fetched once per key and kept for as long as the page lives.
 * Suspends, so callers sit inside a Suspense boundary.
 */
export function useFileBlob(file: RenderableFile): Blob {
  const loader = useFileLoader()
  // A loader that changes (a new run, say) must not be read from a closure that
  // an already-cached query was created with.
  const latest = useRef({ file, loader })
  latest.current = { file, loader }
  const { data } = useSuspenseQuery({
    queryKey: ["render-file", file.key],
    queryFn: () => latest.current.loader(latest.current.file),
    staleTime: Infinity,
    retry: false,
  })
  return data
}

export function useFileText(file: RenderableFile): string {
  const blob = useFileBlob(file)
  const latest = useRef(blob)
  latest.current = blob
  // Decoding is asynchronous, so the text is its own cached value beside the
  // blob rather than a synchronous derivation of it.
  const { data } = useSuspenseQuery({
    queryKey: ["render-file-text", file.key],
    queryFn: () => latest.current.text(),
    staleTime: Infinity,
    retry: false,
  })
  return data
}
