import { type FilePublic, FilesService } from "../../client"
import type { FileLoader, RenderableFile } from "./fileSource"

/** In the portal, a file's bytes come from the API by its id. */
export const portalFileLoader: FileLoader = async (file) => {
  const { data } = await FilesService.downloadFile({
    path: { id: file.key },
    responseType: "blob",
    throwOnError: true,
  })
  return data as Blob
}

export const portalRenderable = (file: FilePublic): RenderableFile => ({
  key: file.id,
  name: file.name,
  file_type: file.file_type,
  size: file.size,
  is_group: file.is_group,
})
