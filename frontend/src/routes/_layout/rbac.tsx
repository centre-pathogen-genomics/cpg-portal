import { createFileRoute, redirect } from "@tanstack/react-router"
import { Suspense } from "react"

import { UsersService } from "@/client"
import { PermissionsPanel } from "@/components/RBAC/PermissionsPanel"
import { RolesPanel } from "@/components/RBAC/RolesPanel"
import { UserAccessPanel } from "@/components/RBAC/UserAccessPanel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useAuth from "@/hooks/useAuth"
import { hasPermission } from "@/lib/permissions"

export const Route = createFileRoute("/_layout/rbac")({
  beforeLoad: async () => {
    const response = await UsersService.readUserMe({ throwOnError: true })
    if (!hasPermission(response.data, "rbac:read")) {
      throw redirect({ to: "/" })
    }
  },
  head: () => ({ meta: [{ title: "Access Control | CPG Portal" }] }),
  component: AccessControl,
})

const TAB_TRIGGER_CLASS =
  "rounded-t-md rounded-b-none border border-transparent px-4 py-2 data-[state=active]:border-border data-[state=active]:border-b-background data-[state=active]:shadow-none"

function PanelFallback() {
  return (
    <p className="text-muted-foreground py-8 text-sm" role="status">
      Loading…
    </p>
  )
}

function AccessControl() {
  const { user } = useAuth()
  const canCreate = hasPermission(user, "rbac:create")
  const canUpdate = hasPermission(user, "rbac:update")
  const canDelete = hasPermission(user, "rbac:delete")

  return (
    <div className="w-full px-4 md:px-6">
      <h1 className="py-6 text-center text-4xl font-bold md:text-left">
        Access Control
      </h1>
      <p className="text-muted-foreground mb-6 max-w-3xl text-sm">
        Roles grant permissions; direct user permissions are for exceptions.
      </p>
      <Tabs defaultValue="Roles">
        <TabsList className="no-scroll h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="Roles" className={TAB_TRIGGER_CLASS}>
            Roles
          </TabsTrigger>
          <TabsTrigger value="Permissions" className={TAB_TRIGGER_CLASS}>
            Permissions
          </TabsTrigger>
          <TabsTrigger value="Users" className={TAB_TRIGGER_CLASS}>
            Users
          </TabsTrigger>
        </TabsList>
        <TabsContent value="Roles" className="mt-4">
          <Suspense fallback={<PanelFallback />}>
            <RolesPanel
              canCreate={canCreate}
              canUpdate={canUpdate}
              canDelete={canDelete}
            />
          </Suspense>
        </TabsContent>
        <TabsContent value="Permissions" className="mt-4">
          <Suspense fallback={<PanelFallback />}>
            <PermissionsPanel />
          </Suspense>
        </TabsContent>
        <TabsContent value="Users" className="mt-4">
          <Suspense fallback={<PanelFallback />}>
            <UserAccessPanel canUpdate={canUpdate} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
