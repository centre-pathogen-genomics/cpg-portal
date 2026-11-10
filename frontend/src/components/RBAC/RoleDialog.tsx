import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { LoaderCircle, Save } from "lucide-react"
import { useState } from "react"

import type { RolePublic } from "@/client"
import {
  createRoleMutation,
  readPermissionsOptions,
  readRolesQueryKey,
  readUserMeQueryKey,
  updateRoleMutation,
} from "@/client/@tanstack/react-query.gen"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/ui/multi-select"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface RoleDialogProps {
  role: RolePublic | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const invalidateUserAccess = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({
    predicate: (query) =>
      (query.queryKey[0] as { _id?: string } | undefined)?._id ===
      "rbacReadUserAccess",
  })

export function RoleDialog({ role, open, onOpenChange }: RoleDialogProps) {
  const [name, setName] = useState(role?.name ?? "")
  const [description, setDescription] = useState(role?.description ?? "")
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    role?.permissions ?? [],
  )
  const { data: permissions } = useSuspenseQuery(readPermissionsOptions())
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: readRolesQueryKey() })
    queryClient.invalidateQueries({ queryKey: readUserMeQueryKey() })
    invalidateUserAccess(queryClient)
    showSuccessToast(role ? `Updated role ${name}` : `Created role ${name}`)
    onOpenChange(false)
  }

  const createMutation = useMutation({
    ...createRoleMutation(),
    onSuccess,
    onError: (error) => handleError(error, showErrorToast),
  })
  const updateMutation = useMutation({
    ...updateRoleMutation(),
    onSuccess,
    onError: (error) => handleError(error, showErrorToast),
  })

  const pending = createMutation.isPending || updateMutation.isPending
  const canSubmit = name.trim().length > 0 && !pending
  const options = permissions.map((permission) => ({
    label: permission.name,
    value: permission.name,
    description: permission.description,
  }))

  const submit = () => {
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      permissions: [...new Set(selectedPermissions)],
    }
    if (role) {
      updateMutation.mutate({ path: { role_id: role.id }, body })
    } else {
      createMutation.mutate({ body })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (canSubmit) submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{role ? "Edit role" : "Create role"}</DialogTitle>
            <DialogDescription>
              A role grants the selected permissions to every user that holds
              it.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={description}
                maxLength={255}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <MultiSelect
                options={options}
                value={selectedPermissions}
                onValueChange={setSelectedPermissions}
                placeholder="Select permissions"
                searchPlaceholder="Search permissions..."
                unitLabel="permission"
                aria-label="Permissions"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
              {role ? "Save role" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
