import { useSuspenseQuery } from "@tanstack/react-query"
import { Component, type ReactNode, useState } from "react"
import { parseFile, type Seq } from "seqparse"
import { SeqViz } from "seqviz"
import { useTheme } from "@/components/theme-provider"
import { downloadFileOptions } from "../../client/@tanstack/react-query.gen"

interface GenbankFileProps {
  fileId: string
  viewer?: "linear" | "circular" | "both"
  height?: number
}

// Error Boundary to catch parsing errors
class GenbankErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <p className="text-red-500">Could not parse GenBank file</p>
    }
    return this.props.children
  }
}

const GenbankFileContent = ({
  fileId,
  height = 500,
  viewer = "both",
}: GenbankFileProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { resolvedTheme: colorMode } = useTheme()

  // Fetch the GenBank file content
  const { data: genbankContent } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  })

  const genbank =
    typeof genbankContent === "string"
      ? genbankContent
      : new TextDecoder().decode(genbankContent as ArrayBuffer)

  // Parse GenBank file - seqparse handles GenBank format directly
  const { data: parsed } = useSuspenseQuery<Seq[]>({
    queryKey: ["genbank-parse", fileId],
    queryFn: () => parseFile(genbank, { fileName: "file.gb" }),
    retry: false,
  })

  if (!parsed) {
    return <p className="text-gray-500">No sequences found in GenBank file</p>
  }

  const sequences = parsed

  if (sequences.length === 0) {
    return <p className="text-gray-500">No sequences found in GenBank file</p>
  }

  const currentSeq = sequences[selectedIndex]

  if (!currentSeq) {
    return <p className="text-gray-500">Invalid sequence selected</p>
  }

  const { name, seq, annotations } = currentSeq

  // Adapt colors for dark/light mode
  const bpColors =
    colorMode === "dark"
      ? { A: "#42a5f5", T: "#ef5350", C: "#66bb6a", G: "#ffa726" }
      : { A: "#1976d2", T: "#d32f2f", C: "#388e3c", G: "#f57c00" }

  const textColor = colorMode === "dark" ? "#e0e0e0" : "#2a2a2a"

  return (
    <div className="flex flex-col items-stretch gap-3">
      {sequences.length > 1 && (
        <select
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          className="h-9 max-w-[400px] rounded-md border bg-background px-3"
        >
          {sequences.map((s, idx) => (
            <option key={idx} value={idx}>
              {s.name || `Sequence ${idx + 1}`} ({s.seq?.length || 0} bp)
            </option>
          ))}
        </select>
      )}
      <div
        style={{ "--sequence-text": textColor } as React.CSSProperties}
        className="[&_svg_text]:!fill-[var(--sequence-text)]"
      >
        <SeqViz
          seq={seq}
          annotations={annotations}
          name={name}
          viewer={viewer}
          style={{ height: `${height}px`, width: "100%" }}
          bpColors={bpColors}
          showComplement={false}
        />
      </div>
    </div>
  )
}

const GenbankFile = (props: GenbankFileProps) => {
  return (
    <GenbankErrorBoundary>
      <GenbankFileContent {...props} />
    </GenbankErrorBoundary>
  )
}

export default GenbankFile
