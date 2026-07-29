import { useSuspenseQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { VegaEmbed, type VegaEmbedProps } from "react-vega"
import { useTheme } from "@/components/theme-provider"
import { downloadFileOptions } from "../../client/@tanstack/react-query.gen"

interface VegaFileProps {
  fileId: string
  height?: number
  leftNegativeMargin?: number
}

const VegaFile = ({
  fileId,
  height = 500,
  leftNegativeMargin = 65,
}: VegaFileProps) => {
  // Fetch the text file content
  const { data: vega } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  })

  const { resolvedTheme } = useTheme()
  const defaultTheme = resolvedTheme === "dark" ? "dark" : undefined
  const [selectedTheme, setSelectedTheme] = useState<string | undefined>(
    defaultTheme,
  )
  const [width, setWidth] = useState<number>(500)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const themes = [
    { value: undefined, label: "Vega" },
    { value: "carbong10", label: "Carbon G10" },
    { value: "carbong100", label: "Carbon G100" },
    { value: "dark", label: "Dark" },
    { value: "excel", label: "Excel" },
    { value: "fivethirtyeight", label: "FiveThirtyEight" },
    { value: "ggplot2", label: "ggplot2" },
    { value: "googlecharts", label: "Google Charts" },
    { value: "latimes", label: "LA Times" },
    { value: "powerbi", label: "Power BI" },
    { value: "quartz", label: "Quartz" },
    { value: "urbaninstitute", label: "Urban Institute" },
    { value: "vox", label: "Vox" },
  ]

  return (
    <div className="flex flex-col items-start gap-3">
      <select
        value={selectedTheme}
        onChange={(e) => setSelectedTheme(e.target.value)}
        className="h-9 max-w-[300px] rounded-md border bg-background px-3"
      >
        {themes.map((theme) => (
          <option key={theme.value} value={theme.value}>
            {theme.label}
          </option>
        ))}
      </select>
      <div ref={containerRef} className="w-full">
        <VegaEmbed
          spec={vega as object}
          options={{
            actions: true,
            padding: 10,
            width: width - leftNegativeMargin,
            height: height,
            theme: selectedTheme as NonNullable<
              VegaEmbedProps["options"]
            >["theme"],
          }}
        />
      </div>
    </div>
  )
}

export default VegaFile
