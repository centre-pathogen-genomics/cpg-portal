import { useNavigate } from "@tanstack/react-router"
import { type ComponentType, useState } from "react"
import { useForm } from "react-hook-form"
import { FaPlus, FaSearch } from "react-icons/fa"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface NavbarProps {
  type: string
  addModalAs: ComponentType<{
    isOpen: boolean
    onClose: () => void
  }>
}

const Navbar = ({ type, addModalAs }: NavbarProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const { register, handleSubmit } = useForm<{ search?: string }>({
    defaultValues: { search: "" },
  })

  const onSubmit = ({ search }: { search?: string }) => {
    const query = search?.trim()

    if (!query) {
      navigate({ to: "/", resetScroll: true })
      return
    }

    navigate({ to: "/search/$query", params: { query } })
  }

  const AddModal = addModalAs
  return (
    <div className="flex gap-4 py-8">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="relative w-full md:w-auto"
      >
        <FaSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          {...register("search", { required: false })}
          type="search"
          placeholder="Search"
          className="rounded-lg pl-9 text-sm md:text-base"
        />
      </form>
      <Button
        className="gap-1 text-sm md:text-base"
        onClick={() => setIsOpen(true)}
      >
        <FaPlus /> Add {type}
      </Button>
      <AddModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  )
}

export default Navbar
