import { useSuspenseQuery } from "@tanstack/react-query"
import { downloadFileOptions } from "../../client/@tanstack/react-query.gen"

interface TextFileProps {
  fileId: string
}

const TextFile = ({ fileId }: TextFileProps) => {
  // Fetch the text file content
  const { data: textContent } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  })

  // Convert content to string based on type
  const displayContent = (() => {
    if (typeof textContent === "string") {
      return textContent
    }
    if (textContent instanceof ArrayBuffer) {
      return new TextDecoder().decode(textContent)
    }
    // Handle JSON objects and other types
    return JSON.stringify(textContent, null, 2)
  })()

  return (
    <pre className="max-h-[500px] overflow-y-auto whitespace-pre-wrap font-sans">
      {displayContent}
    </pre>
  )
}

export default TextFile
