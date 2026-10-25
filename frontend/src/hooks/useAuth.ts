import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import {
  type BodyLoginLoginAccessToken as AccessToken,
  LoginService,
  type UserRegister,
  UsersService,
} from "@/client"
import { readUserMeOptions } from "@/client/@tanstack/react-query.gen"
import { handleError } from "@/utils"
import useCustomToast from "./useCustomToast"

const isLoggedIn = () => {
  const token = localStorage.getItem("access_token")
  if (!token) return false

  try {
    const [, payload] = token.split(".")
    if (!payload) return false
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    )
    return typeof decoded.exp !== "number" || decoded.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

const useAuth = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const { data: user } = useQuery({
    ...readUserMeOptions(),
    enabled: isLoggedIn(),
  })

  const signUpMutation = useMutation({
    mutationFn: (data: UserRegister) =>
      UsersService.registerUser({ body: data, throwOnError: true }),
    onSuccess: () => {
      navigate({ to: "/login" })
    },
    onError: (error) => handleError(error, showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const login = async (data: AccessToken) => {
    const response = await LoginService.loginAccessToken({
      body: data,
      throwOnError: true,
    })
    localStorage.setItem("access_token", response.data.access_token)
  }

  const loginMutation = useMutation({
    mutationFn: ({ data }: { data: AccessToken; redirect?: string }) =>
      login(data),
    onSuccess: (_result, variables) => {
      // Only a path on this site, so a crafted link cannot send someone away.
      const target = variables.redirect
      const path =
        target && target.startsWith("/") && !target.startsWith("//")
          ? target
          : "/"
      navigate({ to: path })
    },
    onError: (error) => handleError(error, showErrorToast),
  })

  const logout = () => {
    localStorage.removeItem("access_token")
    navigate({ to: "/login" })
  }

  return {
    signUpMutation,
    loginMutation,
    logout,
    user,
  }
}

export { isLoggedIn }
export default useAuth
