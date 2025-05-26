import {
  Button,
  Container,
  Heading,
  Text,
  Spinner,
  VStack,
} from "@chakra-ui/react"
import { useMutation } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useEffect } from "react"

import { UsersService } from "../client"
import { isLoggedIn } from "../hooks/useAuth"
import useCustomToast from "../hooks/useCustomToast"

export const Route = createFileRoute("/activate-account")({
  component: ActivateAccount,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
})

function ActivateAccount() {
  const showToast = useCustomToast()

  const token = new URLSearchParams(window.location.search).get("token")

  const mutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("No activation token found.")
      return UsersService.activateAccount({query: { token }})
    },
    onSuccess: () => {
      showToast("Account Activated", "Your account has been successfully activated!", "success")
    },
    onError: (err) => {
      showToast("Activation Failed", err instanceof Error ? err.message : "Invalid or expired token", "error")
    },
  })

  useEffect(() => {
    if (token) {
      mutation.mutate()
    }
  }, [token])

  return (
    <Container h="100vh" maxW="md" centerContent justifyContent="center">
      <VStack spacing={6} textAlign="center" mt={8}>
        <Heading size="lg" color="ui.main">
          Account Activation
        </Heading>
        {mutation.isPending && (
          <>
            <Text>Activating your account, please wait...</Text>
            <Spinner size="lg" />
          </>
        )}
        {mutation.isSuccess && (
          <>
            <Text>Your account has been successfully activated. You can now log in.</Text>
            <Button as="a" href="/login" colorScheme="teal">
              Go to Login
            </Button>
          </>
        )}
        {mutation.isError && (
          <>
            <Text>There was a problem activating your account. Please request a new activation link.</Text>
            <Button as="a" href="/resend-activation" colorScheme="orange">
              Resend Activation Email
            </Button>
          </>
        )}
      </VStack>
    </Container>
  )
}
