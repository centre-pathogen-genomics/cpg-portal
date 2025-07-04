import { AxiosProgressEvent, type AxiosError } from "axios"
import type { ValidationError } from "./client"
import { FilesService } from "./client";

export const uploadFileWithProgress = async (
  file: File,
  controller: AbortController,
  onUploadProgress: (progressEvent: AxiosProgressEvent) => void
) => {
  try {
    const response = await FilesService.uploadFile(
      {
        body: {file},
        onUploadProgress: onUploadProgress,
        throwOnError: true,
        signal: controller.signal,
      },
    );
    return response;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};

export const emailPattern = {
  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  message: "Invalid email address",
}

export const namePattern = {
  value: /^[A-Za-z\s\u00C0-\u017F]{1,30}$/,
  message: "Invalid name",
}

export const humanReadableFileSize = (bytes: number) => {
  if (bytes === 0) {
    return "0 B"
  }
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (
    (bytes / Math.pow(1024, i)).toFixed(0) + " " + ["B", "kB", "MB", "GB", "TB"][i]
  )
}

export const humanReadableDate = (date: string) => {
  // 7 Sept 2021
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export const humanReadableDateTime = (date: string | undefined) => {
  // 7 Sept 2021, 12:00:00
  if (!date) {
    return ""
  }
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }) + ", " + new Date(date).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export const passwordRules = (isRequired = true) => {
  const rules: any = {
    minLength: {
      value: 8,
      message: "Password must be at least 8 characters",
    },
  }

  if (isRequired) {
    rules.required = "Password is required"
  }

  return rules
}

export const confirmPasswordRules = (
  getValues: () => any,
  isRequired = true,
) => {
  const rules: any = {
    validate: (value: string) => {
      const password = getValues().password || getValues().new_password
      return value === password ? true : "The passwords do not match"
    },
  }

  if (isRequired) {
    rules.required = "Password confirmation is required"
  }

  return rules
}

export const handleError = (err: AxiosError | Error, showToast: any) => {
  if (err.message === "Network Error") {
    showToast("Error", "Network error. Please try again later.", "error")
    return
  }
  const errDetail = (err as any)?.response.data.detail as ValidationError | ValidationError[] | string
  let errorMessage = errDetail || "Something went wrong."
  if (Array.isArray(errDetail) && errDetail.length > 0) {
    errorMessage = errDetail[0].msg
  }
  showToast("Error", errorMessage, "error")
}
