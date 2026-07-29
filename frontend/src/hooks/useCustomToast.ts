import { toast } from "sonner"

const useCustomToast = () => {
  const showSuccessToast = (description: string) => {
    toast.success("Success!", {
      description,
    })
  }

  const showErrorToast = (description: string) => {
    toast.error("Something went wrong!", {
      description,
    })
  }

  const customToast = (
    title: string,
    description: string,
    status: "success" | "error" | "warning" | "info" = "success",
  ) => {
    if (status === "error") toast.error(title, { description })
    else if (status === "warning") toast.warning(title, { description })
    else if (status === "info") toast.info(title, { description })
    else toast.success(title, { description })
  }

  return Object.assign(customToast, { showSuccessToast, showErrorToast })
}

export default useCustomToast
