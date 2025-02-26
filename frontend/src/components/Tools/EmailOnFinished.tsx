import { Checkbox } from "@chakra-ui/react"

interface EmailOnFinishedProps {
    emailOnFinished: boolean
    setEmailOnFinished: (value: boolean) => void
}

const EmailOnFinished =  ({ emailOnFinished, setEmailOnFinished }: EmailOnFinishedProps) => {

  return (
    <Checkbox  
        isChecked={emailOnFinished} 
        onChange={(e) => setEmailOnFinished(e.target.checked)}
    >Email me when finished</Checkbox>
  )
}

export default EmailOnFinished
