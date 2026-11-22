import type { ReactNode } from "react"
import { BookOpen, ExternalLink, Info, SlidersHorizontal } from "lucide-react"
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
  badges?: { badge?: string | null; url?: string | null }[]
  tags?: string[]
  command?: string
  explanation_of_results_markdown?: string | null
  min_cpus?: number
  max_cpus?: number | null
  default_cpus?: number | null
  targets?: { path: string }[]
  setup_files?: { name: string }[]
  params?: { name: string; param_type?: string; required?: boolean }[]
  timeline?: { name?: string; title?: string; description?: string }[]
  environment?: string | null
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

const SHIELD_TONES: Record<string, string> = {
  brand: "bg-primary text-primary-foreground",
  license: "bg-emerald-600 text-white",
  github: "bg-slate-600 text-white",
  doi: "bg-violet-600 text-white",
  tag: "bg-muted text-muted-foreground",
}

/**
 * A shields.io-style badge: a muted label segment next to a coloured value
 * segment, optionally linking out. Rendered locally so it stays
 * palette-consistent and works offline; the pack's own shield images are
 * still shown as images.
 */
function ShieldBadge({
  label,
  value,
  url,
  onOpen,
  tone = "brand",
}: {
  label: string
  value?: string
  url?: string | null
  onOpen?: (url: string) => void
  tone?: keyof typeof SHIELD_TONES
}) {
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={`text-[10px] leading-none tracking-wide lowercase ${
        url ? "cursor-pointer" : "cursor-default"
      }`}
      onClick={
        url && onOpen
          ? (event) => {
              event.preventDefault()
              onOpen(url)
            }
          : undefined
      }
    >
      <span className="border-border inline-flex h-5 items-center overflow-hidden rounded-[3px] border">
        <span className="bg-foreground/85 text-background flex h-full items-center px-1.5 font-semibold [text-transform:capitalize]">
          {label}
        </span>
        {value && (
          <span
            className={`flex h-full items-center px-1.5 font-semibold [text-transform:capitalize] ${SHIELD_TONES[tone]}`}
          >
            {value}
          </span>
        )}
      </span>
    </a>
  )
}

/**
 * The tool's badges as a GitHub-README-style row of shields: the pack's own
 * shield images stay images, everything else becomes a locally rendered
 * shields.io-style badge linked to its source. Shown at the top of the
 * Documentation tab.
 */
function ReadmeBadges({
  tool,
  onOpenExternal,
}: {
  tool: ToolTabsTool
  onOpenExternal?: (url: string) => void
}) {
  const items: {
    label: string
    value?: string
    url?: string | null
    tone: keyof typeof SHIELD_TONES
  }[] = []
  const keyOf = (label: string) => `badge-${label}`
  if (tool.license)
    items.push({ label: "license", value: tool.license, tone: "license" })
  if (tool.docs_url)
    items.push({ label: "docs", value: "docs", url: tool.docs_url, tone: "brand" })
  if (tool.paper_doi)
    items.push({
      label: "doi",
      value: tool.paper_doi,
      url: `https://doi.org/${tool.paper_doi}`,
      tone: "doi",
    })
  if (tool.github_repo)
    items.push({
      label: "github",
      value: tool.github_repo.replace(/^https?:\/\//, ""),
      url: tool.github_repo,
      tone: "github",
    })
  for (const tag of tool.tags ?? [])
    items.push({ label: "#", value: tag, tone: "tag" })

  const hasShields = tool.badges?.some((entry) =>
    entry.badge?.startsWith("http"),
  )
  if (items.length === 0 && !hasShields) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tool.badges?.map((entry, index) =>
        entry.badge?.startsWith("http") ? (
          <a
            key={keyOf(`shield-${index}`)}
            href={entry.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            onClick={
              entry.url && onOpenExternal
                ? (event) => {
                    event.preventDefault()
                    onOpenExternal(entry.url as string)
                  }
                : undefined
            }
          >
            <img src={entry.badge} alt="" className="h-5" />
          </a>
        ) : (
          <ShieldBadge
            key={keyOf(`badge-${index}`)}
            label="info"
            value={entry.badge ?? ""}
            url={entry.url}
            onOpen={onOpenExternal}
          />
        ),
      )}
      {items.map((item, index) => (
        <ShieldBadge
          key={`${keyOf(item.label)}-${index}`}
          label={item.label}
          value={item.value}
          url={item.url}
          onOpen={onOpenExternal}
          tone={item.tone}
        />
      ))}
    </div>
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
  environment,
}: {
  tool: ToolTabsTool
  /** The Configure tab's content, owned by the host (usually the run form). */
  configure: ReactNode
  /** Opens a link in the host's preferred way; defaults to an <a> tag. */
  onOpenExternal?: (url: string) => void
  defaultTab?: "configure" | "documentation" | "details"
  /** The tool's environment.yml, when the host can provide it. */
  environment?: string | null
}) {
  const hasDocumentation =
    !!tool.docs_url ||
    !!tool.explanation_of_results_markdown ||
    !!tool.description ||
    (tool.badges?.length ?? 0) > 0
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList variant="line" className="w-full justify-start gap-5">
        <TabsTrigger value="configure">
          <SlidersHorizontal />
          Configure
        </TabsTrigger>
        <TabsTrigger
          value="documentation"
          className="data-[state=inactive]:text-muted-foreground/55 data-[state=inactive]:[&_svg]:size-3.5"
        >
          <BookOpen />
          Documentation
        </TabsTrigger>
        <TabsTrigger
          value="details"
          className="data-[state=inactive]:text-muted-foreground/55 data-[state=inactive]:[&_svg]:size-3.5"
        >
          <Info />
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
            <ReadmeBadges tool={tool} onOpenExternal={onOpenExternal} />
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
        <dl className="w-full">
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
          {tool.params && tool.params.length > 0 && (
            <DetailRow label="Parameters">
              <div className="flex flex-wrap gap-1.5">
                {tool.params.map((param) => (
                  <Badge
                    key={param.name}
                    variant="outline"
                    title={param.param_type ?? undefined}
                  >
                    {param.name}
                    {param.required === true && (
                      <span className="text-destructive">*</span>
                    )}
                  </Badge>
                ))}
              </div>
            </DetailRow>
          )}
          {tool.timeline && tool.timeline.length > 0 && (
            <DetailRow label="Timeline">
              <div className="flex flex-wrap gap-1.5">
                {tool.timeline.map((step, index) => (
                  <Badge key={`${step.title ?? step.name ?? index}-${index}`} variant="secondary">
                    {step.title ?? step.name}
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
          {(environment ?? tool.environment) && (
            <DetailRow label="Environment">
              <CodeBlock code={environment ?? tool.environment ?? ""} language="yaml" />
            </DetailRow>
          )}
        </dl>
      </TabsContent>
    </Tabs>
  )
}