import {
  ENGINE_DEFAULTS,
  figureSvg,
  forceLayout,
  layoutEngine,
  loadGraph,
} from "@jbrowse/bandage-core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { type RenderableFile, useFileBlob } from "./fileSource";

interface GfaFileProps {
  file: RenderableFile;
}

type GfaFigure =
  | { svg: string; nodeCount: number; edgeCount: number }
  | { error: string };

// Bandage's layout is quadratic-ish in the number of nodes, and the whole file
// is already capped by FileRenderer. Refuse a graph whose drawing would stall
// the page.
const MAX_NODES = 10000;
// The drawing is a viewBox-scaled SVG, so one fixed width is enough: the image
// scales to the pane with the rest of the figure and its legend.
const FIGURE_WIDTH = 1200;

const decodeBlob = async (blob: Blob, compressed: boolean) => {
  if (!compressed) {
    return blob.text();
  }
  const decompressed = blob
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(decompressed).text();
};

const GfaFile = ({ file }: GfaFileProps) => {
  const fileName = file.name;
  const compressed = file.file_type === "gfa.gz";
  const blob = useFileBlob(file);

  const { data: figure } = useSuspenseQuery<GfaFigure>({
    queryKey: ["gfa-figure", file.key, compressed],
    queryFn: async () => {
      try {
        const gfa = await decodeBlob(blob, compressed);
        const graph = loadGraph(gfa, fileName, { maxNodes: MAX_NODES });
        const { result } = await forceLayout(
          graph,
          ENGINE_DEFAULTS,
          layoutEngine,
        );
        return {
          svg: figureSvg(graph, result, { width: FIGURE_WIDTH }),
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Could not draw this GFA file.",
        };
      }
    },
  });

  // Create the URL in an effect, not with useMemo: StrictMode runs an effect,
  // cleans it up and runs it again on mount, so a memoized URL would be
  // revoked while the <img> still points at it. The second effect run creates
  // a fresh URL that the image can load.
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if ("error" in figure) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(
      new Blob([figure.svg], { type: "image/svg+xml" }),
    );
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [figure]);

  if ("error" in figure) {
    return <p className="italic text-gray-500">{figure.error}</p>;
  }

  const exportSvg = () => {
    if (!imageUrl) {
      return;
    }
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `${fileName.replace(/\.gfa(\.gz)?$/i, "") || "graph"}.svg`;
    link.click();
  };

  return (
    <div>
      <div className="relative max-h-[70vh] overflow-auto rounded-t-md border border-b-0 bg-white">
        <img
          src={imageUrl ?? undefined}
          alt={`BandageJS drawing of ${fileName}`}
          className="h-auto w-full"
        />
        <button
          type="button"
          onClick={exportSvg}
          className="absolute top-2 right-2 rounded border bg-background/95 px-2 py-1 text-xs shadow hover:bg-accent"
        >
          Export SVG
        </button>
      </div>
      <div className="flex items-center justify-between rounded-b-md border px-2 py-1 text-muted-foreground text-xs">
        <span>
          {figure.nodeCount.toLocaleString()} nodes ·{" "}
          {figure.edgeCount.toLocaleString()} edges
        </span>
        <a
          href="https://github.com/GMOD/BandageJS"
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          Rendered with BandageJS
        </a>
      </div>
    </div>
  );
};

export default GfaFile;
