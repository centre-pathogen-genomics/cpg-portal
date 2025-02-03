import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { AxiosError } from "axios"
import { loginAccessTokenMutation, readUserMeOptions, registerUserMutation } from "../client/@tanstack/react-query.gen"
import useCustomToast from "./useCustomToast"
import { LoginService } from "../client"

const isLoggedIn = () => {
  return localStorage.getItem("access_token") !== null
}

const checkToken = async () => {
  const access_token = localStorage.getItem("access_token");
  if (!access_token) {
    return false;
  }
  try {
    const response = await LoginService.testToken();
    if (response.status === 200) {
      return true;
    }
  } catch (error) {
    localStorage.removeItem("access_token");
    return false;
  }
  localStorage.removeItem("access_token");
  return false;
}

const useAuth = () => {
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const { data: user, isLoading } = useQuery({
    ...readUserMeOptions(), 
    enabled: isLoggedIn(),
  })

  const signUpMutation = useMutation({
    ...registerUserMutation(),
    onSuccess: () => {
      navigate({ to: "/login" })
      showToast(
        "Account created.",
        "Your account has been created successfully.",
        "success",
      )
    },
    onError: (err) => {
      showToast("Something went wrong.", err.message, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const loginMutation = useMutation({
    ...loginAccessTokenMutation(),
    onSuccess: (token) => {
      localStorage.setItem("access_token", token.access_token)
      // load redirect from query params
      const searchParams = new URLSearchParams(window.location.search)
      const redirect = searchParams.get("redirect")
      queryClient.clear();
      if (redirect) {
        console.log("redirecting to", redirect)
        navigate({ to: redirect })
      } else  {
        navigate({ to: "/" })
      }
    },
    onError: (err) => {
      let errDetail = err.message

      if (err instanceof AxiosError) {
        errDetail = err.message
      }

      if (Array.isArray(errDetail)) {
        errDetail = "Something went wrong"
      }

      setError(errDetail)
    },
  })

  const logout = () => {
    localStorage.removeItem("access_token")
    queryClient.clear();
    setError(null)
    navigate({ to: "/login" })
  }

  return {
    signUpMutation,
    loginMutation,
    logout,
    user,
    isLoading,
    error,
    resetError: () => setError(null),
  }
}

export { isLoggedIn, checkToken }
export default useAuth
