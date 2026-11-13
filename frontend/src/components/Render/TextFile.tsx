import { type RenderableFile, useFileText } from "./fileSource"

const TextFile = ({ file }: { file: RenderableFile }) => {
  const text = useFileText(file)

  return (
    <pre className="max-h-[500px] overflow-y-auto whitespace-pre-wrap font-sans">
      {text}
    </pre>
  )
}

export default TextFile
