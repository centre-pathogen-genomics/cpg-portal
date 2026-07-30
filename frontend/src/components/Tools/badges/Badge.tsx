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
    return <img src={shield} alt={`${label}: ${value}`} />
  }
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={shield} alt={`${label}: ${value}`} />
    </a>
  )
}

export default Badge
