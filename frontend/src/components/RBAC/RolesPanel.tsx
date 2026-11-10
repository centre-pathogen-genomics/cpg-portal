import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import type { RolePublic } from "@/client"
import {
  deleteRoleMutation,
  readRolesOptions,
  readRolesQueryKey,
  readUserMeQueryKey,
} from "@/client/@tanstack/react-query.gen"
import { ConfirmationDialog } from "@/components/Common/ConfirmationDialog"
import { RoleDialog } from "@/components/RBAC/RoleDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface RolesPanelProps {
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

const invalidateUserAccess = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({
    predicate: (query) =>
      (query.queryKey[0] as { _id?: string } | undefined)?._id ===
      "rbacReadUserAccess",
  })

export function RolesPanel({
  canCreate,
  canUpdate,
  canDelete,
}: RolesPanelProps) {
  const { data: roles } = useSuspenseQuery(readRolesOptions())
  const [editorRole, setEditorRole] = useState<RolePublic | "new" | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RolePublic | null>(null)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const deleteMutation = useMutation({
    ...deleteRoleMutation(),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: readRolesQueryKey() })
      queryClient.invalidateQueries({ queryKey: readUserMeQueryKey() })
      invalidateUserAccess(queryClient)
      showSuccessToast("Role deleted")
      setDeleteTarget(null)
      void variables
    },
    onError: (error) => handleError(error, showErrorToast),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Roles bundle permissions and are assigned to users. The default role
          is managed by the server.
        </p>
        {canCreate && (
          <Button onClick={() => setEditorRole("new")}>
            <Plus />
            Create role
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {roles.data.map((role) => (
          <Card key={role.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {role.name}
                  {role.is_default && (
                    <Badge variant="secondary">Default</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {role.description || "No description"}
                </CardDescription>
              </div>
              {!role.is_default && (
                <div className="flex shrink-0 gap-2">
                  {canUpdate && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditorRole(role)}
                    >
                      <Pencil />
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteTarget(role)}
                    >
                      <Trash2 />
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {role.permissions.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  Grants no permissions
                </span>
              )}
              {role.permissions.map((permission) => (
                <Badge key={permission} variant="outline">
                  {permission}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ))}
        {roles.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No roles yet.</p>
        )}
      </div>

      {editorRole && (
        <RoleDialog
          key={editorRole === "new" ? "new" : editorRole.id}
          role={editorRole === "new" ? null : editorRole}
          open
          onOpenChange={(open) => {
            if (!open) setEditorRole(null)
          }}
        />
      )}

      <ConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete role"
        description={
          deleteTarget && (
            <>
              Delete <strong>{deleteTarget.name}</strong>? Every user assigned
              to it loses the permissions it grants.
            </>
          )
        }
        confirmLabel="Delete"
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({ path: { role_id: deleteTarget.id } })
          }
        }}
      />
    </div>
  )
}
