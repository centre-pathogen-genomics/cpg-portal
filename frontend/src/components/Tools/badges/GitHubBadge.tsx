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
    >
      <img src={shield} alt={`GitHub ${type}`} />
    </a>
  )
}

export default GitHubBadge
