import { useSuspenseQuery } from "@tanstack/react-query"
import { downloadFileOptions } from "../../client/@tanstack/react-query.gen"
import Markdown from "../Common/Markdown"

interface MarkdownFileProps {
  fileId: string
}

const MarkdownFile = ({ fileId }: MarkdownFileProps) => {
  // Fetch the text file content
  const { data: markdown } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  })

  return (
    <div className="max-h-[500px] overflow-y-auto whitespace-pre-wrap">
      <Markdown markdown={markdown as string} />
    </div>
  )
}

export default MarkdownFile
