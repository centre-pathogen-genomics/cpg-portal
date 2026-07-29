import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { FaRegSave } from "react-icons/fa"
import { HiCheckCircle } from "react-icons/hi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
    <Badge className="cursor-pointer bg-green-100 p-1 text-green-700 hover:bg-green-100">
      <HiCheckCircle />
      <b className="text-xs">
        Saved to{" "}
        <button
          type="button"
          className="underline"
          onClick={() => navigate({ to: "/files" })}
        >
          My Files
        </button>
      </b>
    </Badge>
  ) : (
    <Button
      size={size === "xs" ? "sm" : size === "md" ? "default" : size}
      className={size === "xs" ? "h-6 px-2 text-xs" : undefined}
      onClick={() => {
        saveFile.mutate({ path: { id: fileId } })
        setIsSaved(true)
      }}
    >
      <FaRegSave /> Save to My Files
    </Button>
  )
}

export default SaveFileButton
