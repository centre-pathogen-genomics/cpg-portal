import type { UserMe } from "@/client"

export function hasPermission(
  user: Pick<UserMe, "is_superuser" | "permissions"> | undefined,
  permission: string,
): boolean {
  return (
    user?.is_superuser === true ||
    (user?.permissions ?? []).includes(permission)
  )
}
