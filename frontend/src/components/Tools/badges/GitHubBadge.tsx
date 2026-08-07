const GitHubBadge = ({
  type,
  githubRepo,
}: {
  type: string
  githubRepo: string
}) => {
  const shield = `https://img.shields.io/github/${type}/${githubRepo}`
  return (
    <a
      href={`https://github.com/${githubRepo}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-5 items-center"
    >
      <img src={shield} alt={`GitHub ${type}`} className="block h-5" />
    </a>
  )
}

export default GitHubBadge
