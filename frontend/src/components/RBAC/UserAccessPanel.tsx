import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { LoaderCircle, Save } from "lucide-react"
import { useEffect, useState } from "react"

import {
  readPermissionsOptions,
  readRbacUsersOptions,
  readRolesOptions,
  readUserAccessOptions,
  readUserAccessQueryKey,
  readUserMeQueryKey,
  updateUserAccessMutation,
} from "@/client/@tanstack/react-query.gen"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/ui/multi-select"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface UserAccessPanelProps {
  canUpdate: boolean
}

export function UserAccessPanel({ canUpdate }: UserAccessPanelProps) {
  const [selectedUserId, setSelectedUserId] = useState("")
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [directPermissions, setDirectPermissions] = useState<string[]>([])
  const { data: users } = useSuspenseQuery(
    readRbacUsersOptions({ query: { skip: 0, limit: 10000 } }),
  )
  const { data: roles } = useSuspenseQuery(readRolesOptions())
  const { data: permissions } = useSuspenseQuery(readPermissionsOptions())
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const accessQuery = useQuery({
    ...readUserAccessOptions({ path: { user_id: selectedUserId } }),
    enabled: selectedUserId !== "",
  })
  const access = accessQuery.data

  useEffect(() => {
    if (!access) return
    setRoleIds(access.role_ids)
    setDirectPermissions(access.permissions)
  }, [access])

  const mutation = useMutation({
    ...updateUserAccessMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readUserAccessQueryKey({
          path: { user_id: selectedUserId },
        }),
      })
      queryClient.invalidateQueries({ queryKey: readUserMeQueryKey() })
      showSuccessToast("Access updated")
    },
    onError: (error) => handleError(error, showErrorToast),
  })

  const userOptions = users.data.map((user) => ({
    label: user.full_name ? `${user.full_name} — ${user.email}` : user.email,
    value: user.id,
  }))
  const roleOptions = roles.data.map((role) => ({
    label: role.is_default ? `${role.name} (default)` : role.name,
    value: role.id,
  }))
  const permissionOptions = permissions.map((permission) => ({
    label: permission.name,
    value: permission.name,
    description: permission.description,
  }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Assign roles and direct permissions to an account. Effective permissions
        are the union of both.
      </p>

      <div className="grid max-w-xl gap-4">
        <div className="space-y-2">
          <Label>User</Label>
          <MultiSelect
            options={userOptions}
            value={selectedUserId ? [selectedUserId] : []}
            onValueChange={(value) => setSelectedUserId(value[0] ?? "")}
            placeholder="Choose a user"
            searchPlaceholder="Search users..."
            unitLabel="user"
            single
            aria-label="User"
          />
        </div>
      </div>

      {accessQuery.isLoading && selectedUserId && (
        <p className="text-sm text-muted-foreground">Loading access…</p>
      )}
      {accessQuery.isError && (
        <p className="text-sm text-destructive">Could not load access.</p>
      )}

      {access && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Roles and permissions</CardTitle>
            <CardDescription>
              Changes take effect on the user&apos;s next request.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Roles</Label>
              <MultiSelect
                options={roleOptions}
                value={roleIds}
                onValueChange={setRoleIds}
                placeholder="Select roles"
                unitLabel="role"
                disabled={!canUpdate}
                aria-label="Roles"
              />
            </div>
            <div className="space-y-2">
              <Label>Direct permissions</Label>
              <MultiSelect
                options={permissionOptions}
                value={directPermissions}
                onValueChange={setDirectPermissions}
                placeholder="Select direct permissions"
                searchPlaceholder="Search permissions..."
                unitLabel="permission"
                disabled={!canUpdate}
                aria-label="Direct permissions"
              />
            </div>
            <div className="space-y-2">
              <Label>Effective permissions</Label>
              <div className="flex flex-wrap gap-1.5">
                {access.effective_permissions.length === 0 && (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
                {access.effective_permissions.map((permission) => (
                  <Badge key={permission} variant="outline">
                    {permission}
                  </Badge>
                ))}
              </div>
            </div>
            {canUpdate && (
              <Button
                type="button"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    path: { user_id: selectedUserId },
                    body: {
                      role_ids: [...new Set(roleIds)],
                      permissions: [...new Set(directPermissions)],
                    },
                  })
                }
              >
                {mutation.isPending ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Save />
                )}
                Save access
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
