import Badge from "@/components/Tools/badges/Badge"
import GitHubBadge from "@/components/Tools/badges/GitHubBadge"
import { Badge as UiBadge } from "@/components/ui/badge"
import type { ToolConfig } from "../contracts"

/** The tool's links, badges and tags, as the portal's tool page shows them. */
export function ToolBadges({ tool }: { tool: ToolConfig }) {
  const tags = tool.tags ?? []
  const badges = tool.badges ?? []
  const any =
    tool.url ||
    tool.docs_url ||
    tool.paper_doi ||
    tool.license ||
    tool.github_repo ||
    badges.length > 0 ||
    tags.length > 0
  if (!any) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tool.url && (
        <Badge url={tool.url} value={tool.url} label="Home" color="blue" />
      )}
      {tool.docs_url && (
        <Badge
          url={tool.docs_url}
          value={tool.docs_url}
          label="Docs"
          color="purple"
        />
      )}
      {tool.paper_doi && (
        <Badge
          url={`https://doi.org/${tool.paper_doi}`}
          value={tool.paper_doi}
          label="DOI"
          color="red"
        />
      )}
      {tool.license && (
        <Badge value={tool.license} label="License" color="blue" />
      )}
      {tool.github_repo && (
        <>
          <GitHubBadge type="last-commit" githubRepo={tool.github_repo} />
          <GitHubBadge type="stars" githubRepo={tool.github_repo} />
        </>
      )}
      {badges.map((badge) =>
        badge.badge ? (
          <a
            key={badge.badge}
            href={badge.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-5 items-center"
          >
            <img src={badge.badge} alt="" className="block h-5" />
          </a>
        ) : null,
      )}
      {tags.map((tag) => (
        <UiBadge
          key={tag}
          variant="secondary"
          className="h-5 rounded-md text-xs"
        >
          #{tag}
        </UiBadge>
      ))}
    </div>
  )
}
