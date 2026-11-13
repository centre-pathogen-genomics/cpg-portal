import Markdown from "../Common/Markdown"
import { type RenderableFile, useFileText } from "./fileSource"

const MarkdownFile = ({ file }: { file: RenderableFile }) => {
  const markdown = useFileText(file)

  return (
    <div className="max-h-[500px] overflow-y-auto whitespace-pre-wrap">
      <Markdown markdown={markdown} />
    </div>
  )
}

export default MarkdownFile
