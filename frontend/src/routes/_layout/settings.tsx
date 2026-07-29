import { createFileRoute } from "@tanstack/react-router"
import Appearance from "@/components/UserSettings/Appearance"
import ChangePassword from "@/components/UserSettings/ChangePassword"
import DeleteAccount from "@/components/UserSettings/DeleteAccount"
import UserInformation from "@/components/UserSettings/UserInformation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useAuth from "@/hooks/useAuth"

const tabsConfig = [
  { title: "My profile", component: UserInformation },
  { title: "Password", component: ChangePassword },
  { title: "Appearance", component: Appearance },
  { title: "Danger zone", component: DeleteAccount },
]

export const Route = createFileRoute("/_layout/settings")({
  component: UserSettings,
  head: () => ({ meta: [{ title: "Settings | CPG Portal" }] }),
})

function UserSettings() {
  const { user: currentUser } = useAuth()
  if (!currentUser) return null

  return (
    <div className="w-full px-4 md:px-6">
      <h1 className="py-6 text-center text-4xl font-bold md:text-left">
        User Settings
      </h1>
      <Tabs defaultValue={tabsConfig[0].title}>
        <TabsList className="no-scroll h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0">
          {tabsConfig.map(({ title }) => (
            <TabsTrigger
              value={title}
              key={title}
              className="rounded-t-md rounded-b-none border border-transparent px-4 py-2 data-[state=active]:border-border data-[state=active]:border-b-background data-[state=active]:shadow-none"
            >
              {title}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabsConfig.map(({ title, component: Component }) => (
          <TabsContent value={title} key={title} className="p-4">
            <Component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
