import { LoaderCircle } from "lucide-react";
import { lazy, type ReactNode, Suspense } from "react";
import { humanReadableFileSize } from "@/lib/format";
import type { RenderableFile } from "./fileSource";

// One chunk per renderer, so a viewer costs nothing until its file is drawn.
const CsvFileToTable = lazy(() => import("./CsvFileToTable"));
const FastaFile = lazy(() => import("./FastaFile"));
const GenbankFile = lazy(() => import("./GenbankFile"));
const HtmlFile = lazy(() => import("./HtmlFile"));
const ImageFile = lazy(() => import("./ImageFile"));
const JsonFile = lazy(() => import("./JsonFile"));
const MarkdownFile = lazy(() => import("./MarkdownFile"));
const NewickFile = lazy(() => import("./NewickFile"));
const TextFile = lazy(() => import("./TextFile"));
const VegaFile = lazy(() => import("./VegaFile"));
const GfaFile = lazy(() => import("./GfaFile"));

interface FileRendererProps {
  file: RenderableFile;
  showUnsupportedMessage?: boolean;
  showTooLargeMessage?: boolean;
  fileSizeLimit?: number;
  /** Extra tree controls for a Newick file, which owns that file's text. */
  newickActions?: (newick: string) => ReactNode;
}

// The file types FileRenderer knows how to draw, so a caller can offer exactly
// the files that will render instead of guessing by size. Keep in step with the
// switch below.
export const RENDERABLE_FILE_TYPES = [
  "json",
  "text",
  "md",
  "fasta",
  "genbank",
  "gfa",
  "gfa.gz",
  "newick",
  "vega",
  "vega-lite",
  "csv",
  "tsv",
  "html",
  "png",
  "jpeg",
  "svg",
] as const;

export const canRenderFile = (
  file: Pick<RenderableFile, "file_type" | "is_group">,
) =>
  !file.is_group &&
  !!file.file_type &&
  RENDERABLE_FILE_TYPES.includes(
    file.file_type as (typeof RENDERABLE_FILE_TYPES)[number],
  );

const TooLargeToPreview = ({ limit }: { limit: number }) => (
  <div className="flex flex-col items-start gap-4">
    <p className="italic text-gray-500">
      File is too large to preview ({`>${humanReadableFileSize(limit)}`})
    </p>
  </div>
);

/** Compact stand-in while a chunked viewer downloads. The file page and run
    detail share it, so every preview pauses alike instead of a full card. */
export const PreviewLoading = () => (
  <div
    className="text-muted-foreground flex items-center gap-2 py-2 text-sm"
    role="status"
  >
    <LoaderCircle className="size-4 animate-spin" />
    Loading preview…
  </div>
);

const FileRenderer = ({
  file,
  showUnsupportedMessage = true,
  showTooLargeMessage = true,
  fileSizeLimit = 10 * 1024 * 1024, // 10 MB default limit
  newickActions,
}: FileRendererProps) => {
  // Don't attempt to render group files
  if (file.is_group) {
    return null;
  }

  // An empty file has size 0, which is a size we know: it must still render.
  // Only a missing size is unknown, and then we cannot rule it out as too large.
  const size = file.size;
  if (size != null && size < fileSizeLimit) {
    return (
      <Suspense fallback={<PreviewLoading />}>
        {(() => {
          switch (file.file_type) {
            case "json":
              if (size > 1000000) {
                return TooLargeToPreview({ limit: 1000000 });
              }
              if (size > 100000) {
                // For larger JSON files, use TextFile to avoid performance issues
                return <TextFile file={file} />;
              }
              return <JsonFile file={file} />;
            case "text":
              if (size > 1000000) {
                return TooLargeToPreview({ limit: 1000000 });
              }
              return <TextFile file={file} />;
            case "md":
              if (size > 1000000) {
                return TooLargeToPreview({ limit: 1000000 });
              }
              return <MarkdownFile file={file} />;
            case "fasta":
              // Fasta files can be large; handled within FastaFile component
              return <FastaFile file={file} />;
            case "genbank":
              return (
                <GenbankFile
                  file={file}
                  viewer={size > 2000000 ? "circular" : "both"}
                />
              );
            case "gfa":
            case "gfa.gz":
              return <GfaFile file={file} />;
            case "newick":
              if (size > 1000000) {
                return TooLargeToPreview({ limit: 1000000 });
              }
              return <NewickFile file={file} actions={newickActions} />;
            case "vega":
              return <VegaFile file={file} />;
            case "vega-lite":
              return <VegaFile file={file} leftNegativeMargin={110} />;
            case "csv":
            case "tsv":
              return (
                <CsvFileToTable file={file} tsv={file.file_type === "tsv"} />
              );
            case "html":
              return <HtmlFile file={file} />;
            case "png":
            case "jpeg":
            case "svg":
              return <ImageFile file={file} />;

            default:
              return showUnsupportedMessage ? (
                <p className="italic text-gray-500">
                  Preview not available for this file type
                </p>
              ) : null;
          }
        })()}
      </Suspense>
    );
  }
  return showTooLargeMessage ? (
    <TooLargeToPreview limit={fileSizeLimit} />
  ) : null;
};

export default FileRenderer;
