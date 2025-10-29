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
import DownloadFileButton from "../Files/DownloadFileButton";
import { humanReadableFileSize } from "../../utils";

interface FileRendererProps {
  file: FilePublic;
  showUnsupportedMessage?: boolean;
  showTooLargeMessage?: boolean;
  fileSizeLimit?: number;
}

const FileRenderer = ({ 
  file, 
  showUnsupportedMessage = true,
  showTooLargeMessage = true,
  fileSizeLimit = 8389000
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
            case "csv":
              return <CsvFileToTable fileId={file.id} />;
            case "tsv":
              return <CsvFileToTable tsv fileId={file.id} />;
            case "json":
              return <JsonFile fileId={file.id} />;
            case "text":
              return <TextFile fileId={file.id} />;
            case "md":
              return <MarkdownFile fileId={file.id} />;
            case "html":
              return <HtmlFile fileId={file.id} />;
            case "png":
            case "jpeg":
              return <ImageFile fileId={file.id} />;
            case "fasta":
              return <FastaFile fileId={file.id} />;
            case "genbank":
              return <GenbankFile fileId={file.id} viewer={file.size > 2000000 ? 'circular' : 'both'} />;
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
      <VStack spacing={4} align="start">
        <Text color="gray.500" fontStyle="italic">
          File is too large to preview ({`>${humanReadableFileSize(fileSizeLimit)}`})
        </Text>
        <DownloadFileButton file={file} />
      </VStack>
    ) : null;
  }
};

export default FileRenderer;
