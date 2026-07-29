import { useSuspenseQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { downloadFileOptions } from "../../client/@tanstack/react-query.gen"

interface ImageFileProps {
  fileId: string
}

const ImageFile = ({ fileId }: ImageFileProps) => {
  // Fetch binary image data as Blob
  const { data: blob } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId }, responseType: "blob" }),
  })

  // Convert blob to URL (memoized)
  const imageUrl = useMemo(() => {
    if (!blob) return ""
    return URL.createObjectURL(blob as Blob)
  }, [blob])

  return imageUrl ? (
    <img
      src={imageUrl}
      alt="Rendered file"
      className="max-h-[500px] object-contain"
    />
  ) : (
    <div className="h-[200px] animate-pulse bg-muted" />
  )
}

export default ImageFile
