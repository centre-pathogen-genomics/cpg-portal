import { useMemo, useRef, useState } from "react"
import { type JinjaToken, tokenizeJinja } from "./jinjaTemplate"

/** The bits of a tool parameter the command editor cares about. */
export interface CommandParam {
  name: string
  param_type: string
  default?: unknown
  required?: boolean
  description?: string | null
  multiple?: boolean
  allowed_file_types?: string[]
}

interface CommandFieldProps {
  value: string
  onChange: (value: string) => void
  params: CommandParam[]
  disabled?: boolean
}

const TOKEN_CLASS: Record<JinjaToken["kind"], string> = {
  text: "",
  delimiter: "text-muted-foreground",
  comment: "text-muted-foreground italic",
  operator: "text-muted-foreground",
  literal: "text-emerald-600 dark:text-emerald-400",
  keyword: "text-violet-600 dark:text-violet-400",
  filter: "text-amber-600 dark:text-amber-400",
  name: "text-foreground",
}

// No padding: the copy has to keep exactly the same metrics as the textarea
// behind it, or the caret drifts away from the characters.
const PARAM_CLASS = "rounded underline decoration-dotted underline-offset-2"

// One colour per parameter, taken in the order the tool declares them, so a
// command full of references reads by parameter rather than by type. The type
// is a hover away in the tooltip.
const PARAM_COLOURS = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  "bg-lime-500/15 text-lime-700 dark:text-lime-300",
  "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
]

function describeParam(param: CommandParam): string {
  const parts = [param.param_type]
  if (param.default !== undefined && param.default !== null) {
    parts.push(`default ${String(param.default)}`)
  }
  if (param.required) parts.push("required")
  return parts.join(", ")
}

/** How the value reaches the command, for the shapes that are not a plain string. */
function shapeNotes(param: CommandParam): string[] {
  if (param.param_type !== "file") return []
  const notes: string[] = []
  if (param.multiple) notes.push("Multiple files arrive as a list.")
  if (param.allowed_file_types?.includes("pair")) {
    notes.push("A pair arrives as a list of its two files.")
  }
  return notes
}

/**
 * The command as a template author writes it: `{{ value }}` references are
 * highlighted and hovering one reports what the parameter is.
 *
 * A copy of the command with the highlighting is painted behind a transparent
 * textarea, which keeps editing native. The copy holds the parameter names, so
 * hovering looks through the textarea for the token under the pointer.
 */
const CommandField = ({
  value,
  onChange,
  params,
  disabled = false,
}: CommandFieldProps) => {
  const tokens = useMemo(
    () =>
      tokenizeJinja(
        value,
        params.map((param) => param.name),
      ),
    [value, params],
  )
  const overlay = useRef<HTMLPreElement>(null)
  const [hover, setHover] = useState<{
    param: CommandParam
    left: number
    top: number
  } | null>(null)
  const paramsByName = new Map(params.map((param) => [param.name, param]))
  const coloursByName = new Map(
    params.map((param, index) => [
      param.name,
      PARAM_COLOURS[index % PARAM_COLOURS.length],
    ]),
  )
  const shared =
    "p-3 font-mono text-sm leading-6 whitespace-pre-wrap break-words"

  const handlePointerMove = (
    event: React.MouseEvent<HTMLTextAreaElement, MouseEvent>,
  ) => {
    const wrapper = event.currentTarget.parentElement?.getBoundingClientRect()
    const marked = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find(
        (element) =>
          element instanceof HTMLElement && element.dataset.param !== undefined,
      )
    const param =
      marked instanceof HTMLElement && marked.dataset.param
        ? paramsByName.get(marked.dataset.param)
        : undefined
    if (!(marked instanceof HTMLElement) || !param) {
      setHover(null)
      return
    }
    const rect = marked.getBoundingClientRect()
    setHover({
      param,
      left: rect.left - (wrapper?.left ?? 0),
      top: rect.bottom - (wrapper?.top ?? 0) + 6,
    })
  }

  return (
    <div className="relative overflow-hidden rounded-md border bg-background focus-within:border-ring">
      <pre
        ref={overlay}
        aria-hidden
        className={`${shared} absolute inset-0 m-0 overflow-hidden text-foreground`}
      >
        {tokens.map((token, index) =>
          token.kind === "name" && token.param ? (
            <span
              key={index}
              data-param={token.param}
              className={`${PARAM_CLASS} ${coloursByName.get(token.param) ?? ""}`}
            >
              {token.text}
            </span>
          ) : (
            <span key={index} className={TOKEN_CLASS[token.kind]}>
              {token.text}
            </span>
          ),
        )}
        {/* A trailing newline keeps the copy as tall as the textarea. */}
        {"\n"}
      </pre>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHover(null)}
        onScroll={(event) => {
          if (overlay.current) {
            overlay.current.scrollTop = event.currentTarget.scrollTop
          }
        }}
        spellCheck={false}
        disabled={disabled}
        className={`${shared} relative block max-h-[70vh] min-h-28 w-full resize-none overflow-y-auto border-0 bg-transparent text-transparent caret-foreground outline-none [field-sizing:content]`}
      />
      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 max-w-xs rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
          style={{ left: hover.left, top: hover.top }}
        >
          <span className="font-mono font-semibold">{hover.param.name}</span>
          <span className="text-muted-foreground">
            {" — "}
            {describeParam(hover.param)}
          </span>
          {shapeNotes(hover.param).map((note) => (
            <div key={note} className="text-muted-foreground">
              {note}
            </div>
          ))}
          {hover.param.allowed_file_types &&
            hover.param.allowed_file_types.length > 0 && (
              <div className="text-muted-foreground">
                {`Allowed types: ${hover.param.allowed_file_types.join(", ")}`}
              </div>
            )}
          {hover.param.description && (
            <div className="text-muted-foreground">
              {hover.param.description}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CommandField
