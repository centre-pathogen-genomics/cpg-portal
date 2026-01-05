import { Text, VStack, Spinner } from "@chakra-ui/react";
import { Suspense } from "react";
import { FilePublic } from "../../client";
import CsvFileToTable from "./CsvFileToTable";
import JsonFile from "./JsonFile";
import TextFile from "./TextFile";
import MarkdownFile from "./MarkdownFile";
import ImageFile from "./ImageFile";
import HtmlFile from "./HtmlFile";
import FastaFile from "./FastaFile";
import GenbankFile from "./GenbankFile";
import VegaFile from "./VegaFile";
import { humanReadableFileSize } from "../../utils";

interface FileRendererProps {
  file: FilePublic;
  showUnsupportedMessage?: boolean;
  showTooLargeMessage?: boolean;
  fileSizeLimit?: number;
}

const TooLargeToPreview = ({ limit }: { limit: number }) => (
  <VStack spacing={4} align="start">
    <Text color="gray.500" fontStyle="italic">
      File is too large to preview ({`>${humanReadableFileSize(limit)}`})
    </Text>
  </VStack>
);

const FileRenderer = ({ 
  file, 
  showUnsupportedMessage = true,
  showTooLargeMessage = true,
  fileSizeLimit = 10 * 1024 * 1024, // 10 MB default limit
}: FileRendererProps) => {
  // Don't attempt to render group files
  if (file.is_group) {
    return null;
  }

  if (file.size && file.size < fileSizeLimit) {
    return (
      <Suspense fallback={<Spinner size="md" />}>
        {(() => {
          switch (file.file_type) {
            case "json":
              if (file.size > 1000000) {
                return TooLargeToPreview({ limit: 1000000 });
              } else if (file.size > 100000) {
                // For larger JSON files, use TextFile to avoid performance issues
                return <TextFile fileId={file.id} />;
              }
              return <JsonFile fileId={file.id} />;
            case "text":
              if (file.size > 1000000) {
                return TooLargeToPreview({ limit: 1000000 });
              }
              return <TextFile fileId={file.id} />;
            case "md":
              if (file.size > 1000000) {
                return TooLargeToPreview({ limit: 1000000 });
              }
              return <MarkdownFile fileId={file.id} />;
            case "fasta":
              // Fasta files can be large; handled within FastaFile component
              return <FastaFile fileId={file.id} />;
            case "genbank":
              return <GenbankFile fileId={file.id} viewer={file.size > 2000000 ? 'circular' : 'both'} />;
            case "vega":
              return <VegaFile fileId={file.id} />;
            case "vega-lite":
              return <VegaFile fileId={file.id} leftNegativeMargin={110}/>;
            case "csv":
            case "tsv":
              return <CsvFileToTable tsv={file.file_type === 'tsv'} fileId={file.id} />;
            case "html":
              return <HtmlFile fileId={file.id} />;
            case "png":
            case "jpeg":
            case "svg":
              return <ImageFile fileId={file.id} />;

            default:
              return showUnsupportedMessage ? (
                <Text color="gray.500" fontStyle="italic">
                  Preview not available for this file type
                </Text>
              ) : null;
          }
        })()}
      </Suspense>
    );
  } else {
    return showTooLargeMessage ? (
      <TooLargeToPreview limit={fileSizeLimit} />
    ) : null;
  }
};

export default FileRenderer;
