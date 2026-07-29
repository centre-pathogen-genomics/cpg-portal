import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { HiOutlinePlay } from "react-icons/hi2"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ToolMinimalPublic } from "../../client"
import useAuth from "../../hooks/useAuth"
import FavouriteButton from "./FavouriteButton"
import RunToolModal from "./RunToolModal"
import "../../assets/css/App.css"

const fallbackImage =
  "https://images.unsplash.com/photo-1543145499-8193615267de?auto=format&fit=crop&w=800&q=60"

const ToolCard = ({ tool }: { tool: ToolMinimalPublic }) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [isFavourited, setIsFavourited] = useState(tool.favourited ?? false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const openTool = () =>
    navigate({
      to: "/tools/$name",
      params: { name: tool.name },
      resetScroll: true,
    })

  return (
    <>
      <Card
        onClick={openTool}
        className="group max-w-full cursor-pointer gap-0 overflow-hidden py-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl xl:max-w-[400px]"
      >
        <div className="relative flex h-[120px] items-center justify-center overflow-hidden">
          <img
            src={tool.image || fallbackImage}
            alt={tool.name}
            className="h-full w-full object-cover group-hover:brightness-110"
          />
          {user && (
            <div className="absolute inset-0 hidden p-2 group-hover:block">
              <div className="flex w-full justify-end gap-2">
                <FavouriteButton
                  tool={tool}
                  isFavourited={isFavourited}
                  setIsFavourited={setIsFavourited}
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="mr-2 rounded-full text-xl hover:text-green-600"
                  aria-label="Run"
                  title="Run tool"
                  onClick={(event) => {
                    event.stopPropagation()
                    setModalOpen(true)
                  }}
                >
                  <HiOutlinePlay />
                </Button>
              </div>
            </div>
          )}
        </div>
        <CardHeader className="pb-0">
          <CardTitle className="text-3xl">{tool.name}</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <p className="line-clamp-3">{tool.description}</p>
        </CardContent>
        <CardFooter className="justify-between pb-4">
          <div className="no-scroll mr-2 flex flex-nowrap overflow-auto">
            {tool.tags?.map((tag) => (
              <Badge
                variant="secondary"
                className="mr-1 shrink-0 whitespace-nowrap"
                key={tag}
              >
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex text-gray-500">
            <FavouriteButton
              tool={tool}
              isFavourited={isFavourited}
              setIsFavourited={setIsFavourited}
              withCount
              disabled={!user}
            />
            <span className="flex items-center gap-0.5">
              <HiOutlinePlay />
              {tool.run_count || 0}
            </span>
          </div>
        </CardFooter>
      </Card>
      <RunToolModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        toolId={tool.id}
        params={tool.params || []}
      />
    </>
  )
}

export default ToolCard
