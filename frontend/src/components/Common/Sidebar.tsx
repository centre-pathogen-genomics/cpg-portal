import StorageStats from "../Files/StorageStats"
import SidebarItems from "./SidebarItems"

const Sidebar = () => {
  return (
    <aside className="hidden h-full bg-[#fafafa] md:flex dark:bg-[#1a202c]">
      <div className="flex w-[200px] flex-col justify-between bg-secondary p-4 pt-2">
        <div>
          <SidebarItems />
        </div>
        <StorageStats />
      </div>
    </aside>
  )
}

export default Sidebar
