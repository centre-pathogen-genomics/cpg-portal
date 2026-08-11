import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { CopyToClipboard } from "react-copy-to-clipboard"
import { IoIosCheckmarkCircleOutline, IoIosCopy } from "react-icons/io"
import SyntaxHighlighter from "react-syntax-highlighter"
import {
  githubGist,
  vs2015,
} from "react-syntax-highlighter/dist/cjs/styles/hljs"
import { toast } from "sonner"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

interface CodeBlockProps {
  code: string
  language: string
  lineNumbers?: boolean
  maxHeight?: string
  follow?: boolean // If true, enable follow (auto-scroll) behavior.
}

const CodeBlock = ({
  code,
  language,
  lineNumbers,
  maxHeight,
  follow = false,
}: CodeBlockProps) => {
  // Copy-to-clipboard logic
  const [copied, setCopied] = useState(false)
  const { resolvedTheme } = useTheme()
  const style = resolvedTheme === "dark" ? vs2015 : githubGist

  const notify = () => {
    toast.success("Copied to clipboard!")
    handleCopy()
  }

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 5000)
  }

  // Follow (auto-scroll) logic
  const [isFollowing, setIsFollowing] = useState(follow)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const codeContentRef = useRef<HTMLElement>(null)
  const isPlainText = language === "text" || language === "plaintext"
  const lines = code.split("\n")

  const scrollToBottom = useCallback(() => {
    if (!scrollContainerRef.current) return
    scrollContainerRef.current.scrollTop =
      scrollContainerRef.current.scrollHeight
  }, [])

  // Auto-scroll to bottom when new code arrives if follow mode is enabled.
  useLayoutEffect(() => {
    // Keep code in the effect body so new log text retriggers follow mode.
    void code
    if (!follow || !isFollowing || !scrollContainerRef.current) return

    scrollToBottom()
    const frameIds: number[] = []
    frameIds.push(window.requestAnimationFrame(scrollToBottom))
    frameIds.push(
      window.requestAnimationFrame(() => {
        frameIds.push(window.requestAnimationFrame(scrollToBottom))
      }),
    )
    return () => {
      for (const frameId of frameIds) window.cancelAnimationFrame(frameId)
    }
  }, [code, follow, isFollowing, scrollToBottom])

  useLayoutEffect(() => {
    if (!follow || !codeContentRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      if (isFollowing) scrollToBottom()
    })
    resizeObserver.observe(codeContentRef.current)
    return () => resizeObserver.disconnect()
  }, [follow, isFollowing, scrollToBottom])

  // Update follow state based on scrolling.
  const handleScroll = () => {
    if (!scrollContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 200
    if (follow) {
      setIsFollowing(atBottom)
    }
  }

  return (
    <div className="relative rounded-md border">
      {/* Floating copy button in the top right */}
      <div className="absolute top-[6px] right-[6px] z-[3]">
        <CopyToClipboard text={code} onCopy={notify}>
          <Button aria-label="Copy to clipboard" size="icon-sm" variant="ghost">
            {copied ? (
              <IoIosCheckmarkCircleOutline className="text-green-600" />
            ) : (
              <IoIosCopy className="text-gray-500" />
            )}
          </Button>
        </CopyToClipboard>
      </div>
      {/* Scrollable container for the code */}
      <div
        ref={scrollContainerRef}
        onScroll={follow ? handleScroll : undefined}
        style={{ maxHeight }}
        className="overflow-y-auto"
      >
        {isPlainText ? (
          <pre
            ref={codeContentRef as React.RefObject<HTMLPreElement>}
            className="m-0 overflow-visible whitespace-pre-wrap break-words p-4 font-mono text-sm"
          >
            {lineNumbers ? (
              lines.map((line, index) => (
                <span
                  key={`${index}-${line}`}
                  className="grid grid-cols-[3ch_1fr] gap-4"
                >
                  <span className="select-none text-right text-muted-foreground">
                    {index + 1}
                  </span>
                  <span>{line || " "}</span>
                </span>
              ))
            ) : (
              <code>{code}</code>
            )}
          </pre>
        ) : (
          <div ref={codeContentRef as React.RefObject<HTMLDivElement>}>
            <SyntaxHighlighter
              language={language}
              style={style}
              wrapLines={true}
              wrapLongLines={true}
              showLineNumbers={lineNumbers}
              customStyle={{ padding: "16px", margin: 0 }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
      {/* "Follow" button only appears if the follow prop is enabled */}
      {follow && !isFollowing && (
        <Button
          className="absolute right-4 bottom-4"
          onClick={() => setIsFollowing(true)}
        >
          Follow
        </Button>
      )}
    </div>
  )
}

export default CodeBlock
