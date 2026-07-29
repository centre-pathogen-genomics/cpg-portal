import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { FaRegSave } from "react-icons/fa"
import { HiCheckCircle } from "react-icons/hi"
import {
  Button,
  Link,
  Tag,
  TagLabel,
  TagLeftIcon,
} from "@/components/ui/chakra-compat"
import { saveFileMutation } from "../../client/@tanstack/react-query.gen"
import useCustomToast from "../../hooks/useCustomToast"

interface SaveFileButtonProps {
  fileId: string
  saved: boolean
  size?: "xs" | "sm" | "md" | "lg"
}

const SaveFileButton = ({ fileId, saved, size }: SaveFileButtonProps) => {
  const showToast = useCustomToast()
  const [isSaved, setIsSaved] = useState(saved)
  const navigate = useNavigate()

  const saveFile = useMutation({
    ...saveFileMutation({ path: { id: fileId } }),
    onSuccess: () => {
      showToast("Success", "File saved successfully.", "success")
    },
    onError: () => {
      showToast("Error", "An error occurred while saving the file.", "error")
    },
  })

  return isSaved ? (
    <Tag cursor={"pointer"} colorScheme="green" size={size} p={1}>
      <TagLeftIcon size={size} as={HiCheckCircle} />
      <TagLabel as={"b"} fontSize={12}>
        Saved to{" "}
        <Link onClick={() => navigate({ to: "/files" })}>My Files</Link>
      </TagLabel>
    </Tag>
  ) : (
    <Button
      variant="solid"
      size={size}
      leftIcon={<FaRegSave />}
      onClick={() => {
        saveFile.mutate({ path: { id: fileId } })
        setIsSaved(true)
      }}
    >
      Save to My Files
    </Button>
  )
}

export default SaveFileButton
