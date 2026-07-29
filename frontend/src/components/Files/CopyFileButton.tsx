import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { LoaderCircle } from "lucide-react"
import { useState } from "react"
import { FaRegCopy } from "react-icons/fa"
import { HiCheckCircle } from "react-icons/hi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { copyFileMutation } from "../../client/@tanstack/react-query.gen"
import useCustomToast from "../../hooks/useCustomToast"

interface CopyFileButtonProps {
  fileId: string
  size?: "xs" | "sm" | "md" | "lg"
}

const CopyFileButton = ({ fileId, size = "md" }: CopyFileButtonProps) => {
  const showToast = useCustomToast()
  const [isCopied, setIsCopied] = useState(false)
  const navigate = useNavigate()

  const copyFile = useMutation({
    ...copyFileMutation({ path: { id: fileId } }),
    onSuccess: () => {
      setIsCopied(true)
      showToast("Success", "File copied to My Files successfully.", "success")
    },
    onError: () => {
      showToast("Error", "Failed to copy file to My Files.", "error")
    },
  })

  return isCopied ? (
    <Badge className="cursor-pointer bg-green-100 p-1 text-green-700 hover:bg-green-100">
      <HiCheckCircle />
      <b className="text-xs">
        Copied to{" "}
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
      onClick={() => copyFile.mutate({ path: { id: fileId } })}
      disabled={copyFile.isPending}
    >
      {copyFile.isPending ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <FaRegCopy />
      )}
      {copyFile.isPending ? "Copying..." : "Copy to My Files"}
    </Button>
  )
}

export default CopyFileButton
