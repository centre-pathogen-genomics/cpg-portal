import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createFileRoute,
  Link as RouterLink,
  useNavigate,
} from "@tanstack/react-router"
import { LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge as VersionBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import type { ToolPublic, UserPublic } from "../../../client"
import {
  disableLlmSummaryMutation,
  disableToolMutation,
  enableLlmSummaryMutation,
  enableToolMutation,
  installToolMutation,
  readToolByNameOptions,
  readToolByNameQueryKey,
  readUserMeQueryKey,
} from "../../../client/@tanstack/react-query.gen"
import CodeBlock from "../../../components/Common/CodeBlock"
import Badge from "../../../components/Tools/badges/Badge"
import GitHubBadge from "../../../components/Tools/badges/GitHubBadge"
import FavouriteButton from "../../../components/Tools/FavouriteButton"
import RunToolForm from "../../../components/Tools/RunToolForm"
import useCustomToast from "../../../hooks/useCustomToast"

export const Route = createFileRoute("/_layout/tools/$name")({
  component: Tool,
  head: (context) => ({
    meta: [
      {
        name: "description",
        content: `Run and configure ${(context.params as { name: string }).name} in the CPG Portal`,
      },
      { title: `${(context.params as { name: string }).name} | CPG Portal` },
    ],
  }),
})

function ToolToggle({
  tool,
  kind,
}: {
  tool: ToolPublic
  kind: "tool" | "summary"
}) {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const initial = kind === "tool" ? tool.enabled : tool.llm_summary_enabled
  const [enabled, setEnabled] = useState(initial)
  const enable = useMutation({
    ...(kind === "tool" ? enableToolMutation() : enableLlmSummaryMutation()),
    onError: () =>
      showToast(
        "Error",
        `Could not enable ${kind === "tool" ? "tool" : "AI Summary"}`,
        "error",
      ),
    onSuccess: () => {
      setEnabled(true)
      queryClient.invalidateQueries({
        queryKey: readToolByNameQueryKey({ path: { tool_name: tool.name } }),
      })
    },
  })
  const disable = useMutation({
    ...(kind === "tool" ? disableToolMutation() : disableLlmSummaryMutation()),
    onError: () =>
      showToast(
        "Error",
        `Could not disable ${kind === "tool" ? "tool" : "AI Summary"}`,
        "error",
      ),
    onSuccess: () => {
      setEnabled(false)
      queryClient.invalidateQueries({
        queryKey: readToolByNameQueryKey({ path: { tool_name: tool.name } }),
      })
    },
  })
  const id = `enable-${kind}`
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={enabled}
        onCheckedChange={(checked) =>
          (checked ? enable : disable).mutate({ path: { tool_id: tool.id } })
        }
      />
      <Label htmlFor={id}>
        {kind === "tool"
          ? `Tool ${enabled ? "Enabled" : "Disabled"}`
          : `AI Summary ${enabled ? "Enabled" : "Disabled"}`}
      </Label>
    </div>
  )
}

function InstallToolButton({ tool }: { tool: ToolPublic }) {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const mutation = useMutation({
    ...installToolMutation(),
    onError: ({ message }) =>
      showToast("Error", message || "Could not install tool", "error"),
    onSuccess: ({ message }) => {
      showToast("Success", message || "Installation started", "success")
      const queryKey = readToolByNameQueryKey({
        path: { tool_name: tool.name },
      })
      queryClient.invalidateQueries({ queryKey })
      const interval = setInterval(() => {
        const updated = queryClient.getQueryData(queryKey) as ToolPublic
        if (updated?.status !== "installing") clearInterval(interval)
        else queryClient.invalidateQueries({ queryKey })
      }, 5000)
    },
  })
  return (
    <Button
      disabled={tool.status === "installed" || tool.status === "installing"}
      onClick={() => mutation.mutate({ path: { tool_id: tool.id } })}
    >
      {tool.status === "installing" && (
        <LoaderCircle className="animate-spin" />
      )}
      Install
    </Button>
  )
}

function Tool() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(readUserMeQueryKey())
  const { name } = Route.useParams()
  const {
    isError,
    data: tool,
    isPending,
  } = useQuery({ ...readToolByNameOptions({ path: { tool_name: name } }) })
  const [favourited, setFavourited] = useState(false)
  useEffect(() => {
    if (tool) setFavourited(tool.favourited ?? false)
  }, [tool])

  if (isError)
    return (
      <div className="w-full max-w-2xl px-4 pt-12 pb-8">
        <h1 className="text-3xl font-bold">Tool Not Found</h1>
        <p>
          The requested tool could not be found. Please check the ID and try
          again.
        </p>
      </div>
    )
  if (isPending)
    return (
      <div className="flex justify-center">
        <div className="w-full max-w-5xl px-4 pt-6 pb-8">
          <h1 className="mb-2 border-b pb-2 text-4xl font-bold">{name}</h1>
          <Skeleton className="mb-4 h-5" />
          <h2 className="mb-4 text-2xl font-semibold">Configure Tool</h2>
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    )
  const anonymous = !currentUser
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-5xl px-4 pt-6 pb-8">
        <div className="mb-2 flex items-center justify-between border-b pb-2">
          <div className="flex min-w-0 items-center">
            <div className="mr-2 size-10 shrink-0 overflow-hidden rounded-md border-2 md:size-12">
              <img
                src={
                  tool.image ||
                  "https://images.unsplash.com/photo-1543145499-8193615267de?auto=format&fit=crop&w=800&q=60"
                }
                alt={tool.name}
                className="h-full w-full object-cover"
              />
            </div>
            <h1 className="truncate text-4xl font-bold">{tool.name}</h1>
            {tool.version && (
              <VersionBadge className="ml-1 bg-green-500">
                v{tool.version}
              </VersionBadge>
            )}
          </div>
          {currentUser && (
            <FavouriteButton
              tool={tool}
              isFavourited={favourited}
              setIsFavourited={setFavourited}
            />
          )}
        </div>
        <div className="mb-2 flex flex-wrap gap-1">
          {tool.url && (
            <Badge url={tool.url} value={tool.url} label="home" color="blue" />
          )}
          {tool.docs_url && (
            <Badge
              url={tool.docs_url}
              value={tool.docs_url}
              label="docs"
              color="purple"
            />
          )}
          {tool.paper_doi && (
            <Badge
              url={`https://doi.org/${tool.paper_doi}`}
              value={tool.paper_doi}
              label="doi"
              color="red"
            />
          )}
          {tool.license && (
            <Badge value={tool.license} label="license" color="blue" />
          )}
          {tool.github_repo && (
            <>
              <GitHubBadge type="last-commit" githubRepo={tool.github_repo} />
              <GitHubBadge type="stars" githubRepo={tool.github_repo} />
            </>
          )}
          {tool.badges?.map(
            (badge) =>
              badge.badge && (
                <a
                  key={badge.badge}
                  href={badge.url || undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src={badge.badge} alt="" />
                </a>
              ),
          )}
          {tool.tags?.map((tag) => (
            <RouterLink to="/search/$query" params={{ query: tag }} key={tag}>
              <Badge label="#" value={tag} />
            </RouterLink>
          ))}
        </div>
        <p className="mb-4">{tool.description}</p>
        <h2 className="mb-4 text-2xl font-semibold">Configure Tool</h2>
        {anonymous && (
          <p className="mb-4 text-red-600">
            You must be{" "}
            <RouterLink
              to="/login"
              className="text-blue-500 underline"
              search={{ redirect: `/tools/${tool.name}` }}
            >
              logged in
            </RouterLink>{" "}
            to run this tool
          </p>
        )}
        <RunToolForm
          toolId={tool.id}
          params={tool.params || []}
          isDisabled={anonymous}
          onSuccess={(run) =>
            navigate({
              to: "/runs/$runid",
              params: { runid: run.id },
              resetScroll: true,
            })
          }
        />
        {currentUser?.is_superuser && (
          <Accordion type="single" collapsible className="mt-8">
            <AccordionItem value="admin">
              <AccordionTrigger>Admin</AccordionTrigger>
              <AccordionContent>
                <div className="mb-4 flex items-center justify-between">
                  <InstallToolButton tool={tool} />
                  <div className="flex gap-4">
                    <ToolToggle tool={tool} kind="summary" />
                    <ToolToggle tool={tool} kind="tool" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold">
                  Installation Log ({tool.status})
                </h3>
                <CodeBlock
                  code={tool.installation_log || "\n"}
                  language="bash"
                  lineNumbers
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </div>
  )
}

export default Tool
