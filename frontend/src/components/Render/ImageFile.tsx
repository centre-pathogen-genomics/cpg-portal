import { useSuspenseQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { Image, Skeleton } from "@/components/ui/chakra-compat"
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

  return (
    <Image
      src={imageUrl}
      alt="Image"
      fallback={<Skeleton height="200px" />}
      objectFit="contain"
      maxH="500px"
    />
  )
}

export default ImageFile
