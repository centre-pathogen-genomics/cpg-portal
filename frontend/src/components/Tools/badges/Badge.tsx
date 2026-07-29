interface ToolBadgeProps {
  label: string
  value: string
  url?: string
  color?: string
}

const Badge = ({ label, value, url, color = "green" }: ToolBadgeProps) => {
  let shield = `https://img.shields.io/badge/${label}-${encodeURIComponent(value.replace(/-/g, "--"))}`
  if (color) {
    shield += `-${color}`
  }
  if (!url) {
    return <img src={shield} alt={`${label}: ${value}`} />
  }
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={shield} alt={`${label}: ${value}`} />
    </a>
  )
}

export default Badge
