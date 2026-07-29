import { firstSuperuser, firstSuperuserPassword } from "../config"

const apiUrl = process.env.VITE_API_URL ?? "http://localhost:8000"

export const createUser = async ({
  email,
  password,
}: {
  email: string
  password: string
}) => {
  const loginBody = new URLSearchParams({
    username: firstSuperuser,
    password: firstSuperuserPassword,
  })
  const loginResponse = await fetch(`${apiUrl}/api/v1/login/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody,
  })
  if (!loginResponse.ok) {
    throw new Error(`Admin login failed: ${loginResponse.status}`)
  }
  const { access_token: accessToken } = await loginResponse.json()

  const response = await fetch(`${apiUrl}/api/v1/users/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      full_name: "Test User",
      is_active: true,
      is_superuser: false,
    }),
  })
  if (!response.ok) {
    throw new Error(`User creation failed: ${response.status}`)
  }
  return await response.json()
}
