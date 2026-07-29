import { useMutation } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { LoaderCircle } from "lucide-react"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { UsersService } from "../client"
import { isLoggedIn } from "../hooks/useAuth"
import useCustomToast from "../hooks/useCustomToast"

export const Route = createFileRoute("/activate-account")({
  component: ActivateAccount,
  beforeLoad: async () => {
    if (isLoggedIn()) throw redirect({ to: "/" })
  },
})

function ActivateAccount() {
  const showToast = useCustomToast()
  const token = new URLSearchParams(window.location.search).get("token")
  const mutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("No activation token found.")
      return UsersService.activateAccount({ query: { token } })
    },
    onSuccess: () =>
      showToast(
        "Account Activated",
        "Your account has been successfully activated!",
        "success",
      ),
    onError: (error) =>
      showToast(
        "Activation Failed",
        error instanceof Error ? error.message : "Invalid or expired token",
        "error",
      ),
  })
  useEffect(() => {
    if (token) mutation.mutate()
  }, [token, mutation.mutate])

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="mt-8 flex max-w-md flex-col items-center gap-6 text-center">
        <h1 className="text-2xl font-bold text-primary">Account Activation</h1>
        {mutation.isPending && (
          <>
            <p>Activating your account, please wait...</p>
            <LoaderCircle className="size-8 animate-spin" />
          </>
        )}
        {mutation.isSuccess && (
          <>
            <p>
              Your account has been successfully activated. You can now log in.
            </p>
            <Button asChild>
              <a href="/login">Go to Login</a>
            </Button>
          </>
        )}
        {mutation.isError && (
          <>
            <p>
              There was a problem activating your account. Please request a new
              activation link.
            </p>
            <Button asChild className="bg-orange-500 hover:bg-orange-600">
              <a href="/resend-activation">Resend Activation Email</a>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
