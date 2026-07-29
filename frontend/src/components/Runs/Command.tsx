import { HiOutlineCommandLine } from "react-icons/hi2"
import CodeBlock from "../Common/CodeBlock"

function Command({ command }: { command: string }) {
  return (
    <div className="mb-4 flex flex-col">
      <div className="mb-2 flex w-32 flex-col">
        <div className="flex items-center">
          <HiOutlineCommandLine />
          <span className="ml-2">Command</span>
        </div>
      </div>
      <CodeBlock code={command} language="bash" />
    </div>
  )
}

export default Command
