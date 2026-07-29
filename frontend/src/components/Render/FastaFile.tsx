import { useSuspenseQuery } from "@tanstack/react-query"
import { useState } from "react"
import seqparse, { type Seq } from "seqparse"
import { SeqViz } from "seqviz"
import { useTheme } from "@/components/theme-provider"
import { downloadFileOptions } from "../../client/@tanstack/react-query.gen"

interface FastaFileProps {
  fileId: string
  height?: number
}

const FastaFile = ({ fileId, height = 500 }: FastaFileProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { resolvedTheme: colorMode } = useTheme()

  // Fetch the text file content
  const { data: fastaContent } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  })

  const fasta =
    typeof fastaContent === "string"
      ? fastaContent
      : new TextDecoder().decode(fastaContent as ArrayBuffer)

  // Parse each FASTA entry
  const { data: parsed } = useSuspenseQuery<Seq[]>({
    queryKey: ["fasta-parse", fileId, fasta],
    queryFn: async () => {
      try {
        // Split multi-FASTA file into individual sequences
        const fastaEntries = fasta
          .split(/(?=^>)/m)
          .filter((entry) => entry.trim())
        const sequences = await Promise.all(
          fastaEntries.map((entry) => seqparse(entry)),
        )
        return sequences
      } catch (e) {
        console.error("Fasta parsing failed:", e)
        throw e
      }
    },
  })

  if (!parsed || parsed.length === 0) {
    return <p className="text-gray-500">No sequences found in FASTA file</p>
  }

  // All sequences are already in an array
  const sequences = parsed
  const MAX_DISPLAYABLE_BP = 200000 // Adjust based on performance testing

  const currentSeq = sequences[selectedIndex]

  if (!currentSeq) {
    return <p className="text-gray-500">No sequences found in FASTA file</p>
  }

  const { name, seq, annotations } = currentSeq
  const seqLength = seq?.length || 0

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
          viewer={seqLength > MAX_DISPLAYABLE_BP ? "circular" : "linear"}
          style={{ height: `${height}px`, width: "100%" }}
          bpColors={bpColors}
          showComplement={false}
        />
      </div>
    </div>
  )
}

export default FastaFile
