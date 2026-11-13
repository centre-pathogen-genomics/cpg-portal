import { useEffect, useMemo } from "react"
import { type RenderableFile, useFileBlob } from "./fileSource"

const ImageFile = ({ file }: { file: RenderableFile }) => {
  const blob = useFileBlob(file)

  // One URL per blob, released when the image is swapped out or unmounted.
  const imageUrl = useMemo(() => URL.createObjectURL(blob), [blob])
  useEffect(() => {
    return () => {
      URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  return (
    <img
      src={imageUrl}
      alt="Rendered file"
      className="max-h-[500px] object-contain"
    />
  )
}

export default ImageFile
