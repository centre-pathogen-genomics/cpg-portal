import { Checkbox } from "@chakra-ui/react"

interface EmailOnFinishedProps {
    emailOnFinished: boolean
    setEmailOnFinished: (value: boolean) => void
    isDisabled?: boolean // Optional prop to disable the checkbox
}

const EmailOnFinished =  ({ emailOnFinished, setEmailOnFinished, isDisabled = false }: EmailOnFinishedProps) => {

  return (
    <Checkbox  
        isDisabled={isDisabled}
        isChecked={emailOnFinished} 
        onChange={(e) => setEmailOnFinished(e.target.checked)}
    >Email me when finished</Checkbox>
  )
}

export default EmailOnFinished
