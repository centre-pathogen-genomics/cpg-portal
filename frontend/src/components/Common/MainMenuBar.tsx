import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { Menu, Search } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Appearance } from "@/components/Common/Appearance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import Logo from "/assets/images/cpg-logo.png"
import Icon from "/assets/images/cpg-logo-icon.png"
import useAuth from "../../hooks/useAuth"
import SidebarItems from "./SidebarItems"
import UserMenu from "./UserMenu"

function MainMenuBar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState().location.pathname
  const { register, handleSubmit } = useForm<{ search?: string }>({
    defaultValues: { search: "" },
  })

  const signedIn = currentUser !== undefined
  const userItems = signedIn
    ? [
        { title: "Tools", path: "/" },
        { title: "My Runs", path: "/runs" },
        { title: "My Files", path: "/files" },
        {
          title: "SAE",
          path: "/wasm/jupyterlite/index.html",
          isNew: true,
          newTab: true,
        },
        { title: "About", path: "/about" },
      ]
    : [{ title: "About", path: "/about" }]

  const items = currentUser?.is_superuser
    ? [...userItems, { title: "Admin", path: "/admin" }]
    : userItems

  const onSubmit = ({ search }: { search?: string }) => {
    const query = search?.trim()
    if (!query) {
      navigate({ to: "/", resetScroll: true })
      return
    }
    navigate({ to: "/search/$query", params: { query } })
  }

  return (
    <header className="sticky top-0 z-[1000] flex w-full items-center justify-between bg-background py-2 pr-6 pl-4 text-foreground">
      <div className="mr-4 flex flex-1 items-center gap-4">
        <Link to="/" aria-label="CPG Portal home">
          <img
            src={Logo}
            alt="Centre for Pathogen Genomics"
            className="ml-3 hidden max-h-14 py-2 md:block"
          />
          <img
            src={Icon}
            alt="Centre for Pathogen Genomics"
            className="block max-h-14 py-2 md:hidden"
          />
        </Link>
        <form
          className="relative max-w-xl flex-1"
          onSubmit={handleSubmit(onSubmit)}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            {...register("search")}
            id="search"
            type="search"
            placeholder="Search the Portal"
            className="h-10 bg-secondary pl-9 text-base"
          />
        </form>
        <nav className="hidden items-center gap-4 md:flex">
          {items.map(({ title, path, isNew, newTab }) => {
            const active =
              title === "Tools"
                ? pathname === "/" || pathname.startsWith("/tools")
                : pathname.startsWith(path)
            const className = cn(
              "flex items-center whitespace-nowrap font-semibold text-foreground hover:text-primary",
              active && !newTab && "underline",
            )
            return newTab ? (
              <a
                href={path}
                key={title}
                className={className}
                target="_blank"
                rel="noopener noreferrer"
              >
                {title}
                {isNew && <Badge className="ml-1">New</Badge>}
              </a>
            ) : (
              <Link to={path} key={title} className={className}>
                {title}
                {isNew && <Badge className="ml-1">New</Badge>}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="mx-2 hidden md:block">
        <Appearance />
      </div>
      {currentUser ? (
        <UserMenu />
      ) : (
        <div className="hidden gap-4 font-semibold md:flex">
          <Link to="/signup" className="hover:text-primary">
            Sign Up
          </Link>
          <Link
            to="/login"
            search={{ redirect: pathname }}
            className="hover:text-primary"
          >
            Log In
          </Link>
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open Menu"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent className="w-[250px] p-4" side="right">
          <SheetHeader>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
          </SheetHeader>
          <img src={Logo} alt="Centre for Pathogen Genomics" className="p-4" />
          <SidebarItems onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  )
}

export default MainMenuBar
