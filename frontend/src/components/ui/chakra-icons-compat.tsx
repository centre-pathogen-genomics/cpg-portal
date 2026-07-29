import {
  Check,
  CircleCheck,
  CircleHelp,
  CircleSlash,
  Clock,
  Download,
  TriangleAlert,
} from "lucide-react"

type Props = Record<string, any>
const wrap = (Icon: typeof Check) => ({ boxSize, h, ...props }: Props) => (
  <Icon size={boxSize ?? h} {...props} />
)

export const CheckIcon = wrap(Check)
export const CheckCircleIcon = wrap(CircleCheck)
export const QuestionOutlineIcon = wrap(CircleHelp)
export const NotAllowedIcon = wrap(CircleSlash)
export const TimeIcon = wrap(Clock)
export const DownloadIcon = wrap(Download)
export const WarningIcon = wrap(TriangleAlert)
