import CodeBlock from "../Common/CodeBlock"
import { type RenderableFile, useFileText } from "./fileSource"

const JsonFile = ({ file }: { file: RenderableFile }) => {
  const text = useFileText(file)

  // Malformed JSON is shown as it is, rather than failing the whole preview.
  let pretty = text
  try {
    pretty = JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    pretty = text
  }

  return <CodeBlock code={pretty} language="json" maxHeight="500px" />
}

export default JsonFile
