import type { ReactNode } from "react"
import { BookOpen, ExternalLink, ListTree, SlidersHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CodeBlock from "@/components/Common/CodeBlock"
import RenderMarkdown from "@/components/Common/Markdown"

/**
 * The fields a tool page's Documentation and Details tabs need. A structural
 * subset, so both the portal's ToolPublic and the runner's ToolConfig satisfy
 * it without the component knowing either type.
 */
export type ToolTabsTool = {
  id: string
  name: string
  version?: string | null
  description?: string | null
  docs_url?: string | null
  paper_doi?: string | null
  license?: string | null
  github_repo?: string | null
  tags?: string[]
  command?: string
  explanation_of_results_markdown?: string | null
  min_cpus?: number
  max_cpus?: number | null
  default_cpus?: number | null
  targets?: { path: string }[]
  setup_files?: { name: string }[]
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-baseline gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  )
}

function ExternalLinkButton({
  url,
  onOpen,
  label,
}: {
  url: string
  onOpen?: (url: string) => void
  label: string
}) {
  if (onOpen) {
    return (
      <Button type="button" variant="link" className="h-auto p-0" onClick={() => onOpen(url)}>
        <ExternalLink />
        {label}
      </Button>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-primary inline-flex items-center gap-1.5 font-medium hover:underline"
    >
      <ExternalLink />
      {label}
    </a>
  )
}

/**
 * The tool page's three tabs — Configure, Documentation, Details — as one
 * shared component, so the desktop app and the portal show the same tool the
 * same way. Configure is the host's own content (the run form); the other two
 * render from the tool's metadata, with links opened by the host (the runner
 * routes them through its desktop bridge).
 */
export function ToolTabs({
  tool,
  configure,
  onOpenExternal,
  defaultTab = "configure",
}: {
  tool: ToolTabsTool
  /** The Configure tab's content, owned by the host (usually the run form). */
  configure: ReactNode
  /** Opens a link in the host's preferred way; defaults to an <a> tag. */
  onOpenExternal?: (url: string) => void
  defaultTab?: "configure" | "documentation" | "details"
}) {
  const hasDocumentation =
    !!tool.docs_url ||
    !!tool.explanation_of_results_markdown ||
    !!tool.description
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList variant="line" className="w-full justify-start gap-5">
        <TabsTrigger value="configure">
          <SlidersHorizontal />
          Configure
        </TabsTrigger>
        <TabsTrigger value="documentation">
          <BookOpen />
          Documentation
        </TabsTrigger>
        <TabsTrigger value="details">
          <ListTree />
          Details
        </TabsTrigger>
      </TabsList>

      <TabsContent value="configure" className="mt-4">
        {configure}
      </TabsContent>

      <TabsContent value="documentation" className="mt-4">
        {hasDocumentation ? (
          <div className="grid gap-5">
            {tool.docs_url && (
              <div>
                <ExternalLinkButton
                  url={tool.docs_url}
                  onOpen={onOpenExternal}
                  label="Open documentation"
                />
              </div>
            )}
            {tool.explanation_of_results_markdown && (
              <div className="grid gap-3">
                <h3 className="text-lg font-semibold">
                  About the results
                </h3>
                <RenderMarkdown markdown={tool.explanation_of_results_markdown} />
              </div>
            )}
            {tool.description && (
              <p className="text-muted-foreground text-sm">
                {tool.description}
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No documentation was provided with this tool.
          </p>
        )}
      </TabsContent>

      <TabsContent value="details" className="mt-4">
        <dl className="max-w-xl">
          <DetailRow label="Version">
            {tool.version ? (
              <Badge>{tool.version}</Badge>
            ) : (
              <span className="text-muted-foreground">Unknown</span>
            )}
          </DetailRow>
          {tool.license && <DetailRow label="License">{tool.license}</DetailRow>}
          {tool.paper_doi && (
            <DetailRow label="Paper">
              <ExternalLinkButton
                url={`https://doi.org/${tool.paper_doi}`}
                onOpen={onOpenExternal}
                label={tool.paper_doi}
              />
            </DetailRow>
          )}
          {tool.github_repo && (
            <DetailRow label="Source">
              <ExternalLinkButton
                url={tool.github_repo}
                onOpen={onOpenExternal}
                label={tool.github_repo.replace(/^https?:\/\//, "")}
              />
            </DetailRow>
          )}
          {tool.tags && tool.tags.length > 0 && (
            <DetailRow label="Tags">
              <div className="flex flex-wrap gap-1.5">
                {tool.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </DetailRow>
          )}
          <DetailRow label="CPUs">
            {tool.min_cpus !== undefined
              ? `${tool.min_cpus}–${tool.max_cpus ?? "∞"}${
                  tool.default_cpus ? ` (default ${tool.default_cpus})` : ""
                }`
              : "Unknown"}
          </DetailRow>
          {tool.targets && tool.targets.length > 0 && (
            <DetailRow label="Outputs">
              {tool.targets.map((target) => target.path).join(", ")}
            </DetailRow>
          )}
          {tool.setup_files && tool.setup_files.length > 0 && (
            <DetailRow label="Setup files">
              {tool.setup_files.map((file) => file.name).join(", ")}
            </DetailRow>
          )}
          {tool.command && (
            <DetailRow label="Command">
              <CodeBlock code={tool.command} language="bash" />
            </DetailRow>
          )}
        </dl>
      </TabsContent>
    </Tabs>
  )
}