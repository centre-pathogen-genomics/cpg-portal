import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

function RenderMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="prose max-w-none text-foreground dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

export default RenderMarkdown
