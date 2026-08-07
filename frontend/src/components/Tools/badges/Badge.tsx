interface ToolBadgeProps {
  label: string
  value: string
  url?: string
  color?: string
}

const Badge = ({ label, value, url, color = "green" }: ToolBadgeProps) => {
  const shieldLabel = encodeURIComponent(label.replace(/-/g, "--"))
  const shieldValue = encodeURIComponent(value.replace(/-/g, "--"))
  let shield = `https://img.shields.io/badge/${shieldLabel}-${shieldValue}`
  if (color) {
    shield += `-${color}`
  }
  if (!url) {
    return <img src={shield} alt={`${label}: ${value}`} className="block h-5" />
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-5 items-center"
    >
      <img src={shield} alt={`${label}: ${value}`} className="block h-5" />
    </a>
  )
}

export default Badge
