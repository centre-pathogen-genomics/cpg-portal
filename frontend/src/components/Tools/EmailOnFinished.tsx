import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface EmailOnFinishedProps {
  emailOnFinished: boolean
  setEmailOnFinished: (value: boolean) => void
  isDisabled?: boolean // Optional prop to disable the checkbox
}

const EmailOnFinished = ({
  emailOnFinished,
  setEmailOnFinished,
  isDisabled = false,
}: EmailOnFinishedProps) => {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="email-on-finished"
        disabled={isDisabled}
        checked={emailOnFinished}
        onCheckedChange={(checked) => setEmailOnFinished(checked === true)}
      />
      <Label htmlFor="email-on-finished">Email me when finished</Label>
    </div>
  )
}

export default EmailOnFinished
