import PhylocanvasGL, { TreeTypes } from "@phylocanvas/phylocanvas.gl";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { downloadFileOptions } from "../../client/@tanstack/react-query.gen";

interface NewickFileProps {
  fileId: string;
  height?: number;
}

const TREE_TYPES = [
  { value: TreeTypes.Rectangular, label: "Rectangular" },
  { value: TreeTypes.Circular, label: "Circular" },
  { value: TreeTypes.Radial, label: "Radial" },
  { value: TreeTypes.Diagonal, label: "Diagonal" },
  { value: TreeTypes.Hierarchical, label: "Hierarchical" },
];

const colourFromShade = (shade: number) => [shade, shade, shade, 255];

const NewickFile = ({ fileId, height = 500 }: NewickFileProps) => {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<PhylocanvasGL | null>(null);
  const [treeType, setTreeType] = useState<string>(TreeTypes.Rectangular);
  const [error, setError] = useState<string | null>(null);

  // Fetch the text file content
  const { data: content } = useSuspenseQuery({
    ...downloadFileOptions({ path: { id: fileId } }),
  });

  const newick = (
    typeof content === "string"
      ? content
      : new TextDecoder().decode(content as ArrayBuffer)
  ).trim();

  const shade = resolvedTheme === "dark" ? 224 : 42;

  // Keep the latest display options available to the create effect without
  // re-creating the (single-WebGL-context) tree whenever they change.
  const displayOptions = useRef({ treeType, shade });
  displayOptions.current = { treeType, shade };

  // Create the tree when the newick data changes, and tear it down on cleanup.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !newick) return;

    let tree: PhylocanvasGL;
    try {
      tree = new PhylocanvasGL(container, {
        source: newick,
        size: { width: container.clientWidth, height },
        interactive: true,
        showLabels: true,
        showLeafLabels: true,
        type: displayOptions.current.treeType,
        fontColour: colourFromShade(displayOptions.current.shade),
        fillColour: colourFromShade(displayOptions.current.shade),
      });
    } catch (e) {
      console.error("Newick parsing failed:", e);
      setError("Could not parse Newick file");
      return;
    }
    setError(null);
    treeRef.current = tree;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        tree.setProps({
          size: { width: entry.contentRect.width, height },
        });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      tree.destroy();
      treeRef.current = null;
    };
  }, [newick, height]);

  // Apply display option changes to the existing tree.
  useEffect(() => {
    treeRef.current?.setProps({
      type: treeType,
      fontColour: colourFromShade(shade),
      fillColour: colourFromShade(shade),
    });
  }, [treeType, shade]);

  if (!newick) {
    return <p className="text-gray-500">Newick file is empty</p>;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <div className="flex flex-col items-stretch gap-3">
      <select
        value={treeType}
        onChange={(e) => setTreeType(e.target.value)}
        className="h-9 max-w-[300px] rounded-md border bg-background px-3"
      >
        {TREE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-md border"
        style={{ height: `${height}px` }}
      />
    </div>
  );
};

export default NewickFile;
