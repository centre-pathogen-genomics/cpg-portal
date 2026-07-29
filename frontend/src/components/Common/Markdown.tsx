import ChakraUIRenderer from "chakra-ui-markdown-renderer"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

function RenderMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      components={ChakraUIRenderer()}
      remarkPlugins={[remarkGfm]}
      skipHtml
    >
      {markdown}
    </ReactMarkdown>
  )
}

export default RenderMarkdown
