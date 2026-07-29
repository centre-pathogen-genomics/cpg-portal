import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ParamTagProps {
  param: string
  value: unknown
  truncate?: boolean
}

const extractUUIDAndOtherText = (value: string | string[]): string => {
  const pattern =
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}_/i
  const values = Array.isArray(value) ? value : [value]
  const text = values.flatMap((item) => {
    const match = item.match(pattern)
    return match ? [item.substring(match[0].length).trim()] : []
  })
  if (!text.length) return values.join(", ")
  return text.length === 1 ? text[0] : `Group(${text.join(", ")})`
}

const ParamTag = ({ param, value }: ParamTagProps) => {
  let display = value
  if (typeof value === "string") display = extractUUIDAndOtherText(value)
  else if (Array.isArray(value))
    display = value.map((item) => extractUUIDAndOtherText(item)).join(", ")
  else if (typeof value === "boolean") display = String(value)
  const label = String(display)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex cursor-pointer overflow-hidden rounded-md border-2 border-gray-100 text-sm dark:border-white/20">
          <b className="h-full bg-gray-100 px-1 text-primary dark:bg-white/20 dark:text-foreground">
            {param}
          </b>
          <span className="max-w-40 truncate whitespace-nowrap px-1">
            {label}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export default ParamTag
