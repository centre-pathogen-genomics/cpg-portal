import { useSuspenseQuery } from "@tanstack/react-query"

import { readPermissionsOptions } from "@/client/@tanstack/react-query.gen"
import { PermissionDescription } from "@/components/RBAC/PermissionDescription"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function PermissionsPanel() {
  const { data: permissions } = useSuspenseQuery(readPermissionsOptions())

  const groups = new Map<string, typeof permissions>()
  for (const permission of permissions) {
    const resource = permission.name.split(":")[0]
    const group = groups.get(resource) ?? []
    group.push(permission)
    groups.set(resource, group)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Permissions are registered by the API router and synced at startup. A
        permission that no route enforces does not exist here.
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[...groups.entries()].map(([resource, group]) => (
          <Card key={resource}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {resource}
                <Badge variant="secondary">{group.length}</Badge>
              </CardTitle>
              <CardDescription>
                Permissions enforced for the {resource} API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.map((permission) => (
                <div key={permission.name} className="space-y-1">
                  <code className="text-sm font-medium">{permission.name}</code>
                  <div>
                    <PermissionDescription
                      description={permission.description}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
