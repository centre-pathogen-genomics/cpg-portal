from enum import Enum
from typing import ClassVar

from pydantic import BaseModel


# Define a Pydantic model for file type metadata
class FileTypeMetadata(BaseModel):
    extensions: list[str]
    file_format: str
    mime_types: list[str]

class FileTypes:
    # Class-level dictionary of allowed file types with their metadata.
    allowed: ClassVar[dict[str, FileTypeMetadata]] = {
        "bam": FileTypeMetadata(
            extensions=[".bam"],
            file_format="binary",
            mime_types=["application/x-bam"]
        ),
        "beast": FileTypeMetadata(
            extensions=[".trees"],
            file_format="text",
            mime_types=["application/x-beast-trees"]
        ),
        "bed": FileTypeMetadata(
            extensions=[".bed"],
            file_format="text",
            mime_types=["text/bed"]
        ),
        "bib": FileTypeMetadata(
            extensions=[".bib"],
            file_format="text",
            mime_types=["text/x-bibtex"]
        ),
        "csv": FileTypeMetadata(
            extensions=[".csv"],
            file_format="text",
            mime_types=["text/csv"]
        ),
        "docx": FileTypeMetadata(
            extensions=[".docx"],
            file_format="binary",
            mime_types=["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
        ),
        "fasta": FileTypeMetadata(
            extensions=[".fasta", ".fa", ".fna", ".ffn", ".frn", ".faa"],
            file_format="text",
            mime_types=["text/x-fasta"]
        ),
        "fastq": FileTypeMetadata(
            extensions=[".fastq", ".fq"],
            file_format="text",
            mime_types=["text/plain"]
        ),
        "fastq.gz": FileTypeMetadata(
            extensions=[".fastq.gz", ".fq.gz"],
            file_format="binary",
            mime_types=["application/gzip"]
        ),
        "geojson": FileTypeMetadata(
            extensions=[".geojson"],
            file_format="json",
            mime_types=["application/geo+json"]
        ),
        "gff": FileTypeMetadata(
            extensions=[".gff", ".gff3"],
            file_format="text",
            mime_types=["text/gff"]
        ),
        "genbank": FileTypeMetadata(
            extensions=[".gb", ".gbk", ".genbank"],
            file_format="text",
            mime_types=["text/x-genbank"]
        ),
        "graphml": FileTypeMetadata(
            extensions=[".graphml"],
            file_format="text",
            mime_types=["application/graphml+xml"]
        ),
        "gzip": FileTypeMetadata(
            extensions=[".tgz", ".gz", ".gzip"],
            file_format="binary",
            mime_types=["application/gzip"]
        ),
        "hdf5": FileTypeMetadata(
            extensions=[".h5", ".hdf5"],
            file_format="binary",
            mime_types=["application/x-hdf5"]
        ),
        "hs": FileTypeMetadata(
            extensions=[".hs"],
            file_format="text",
            mime_types=["text/x-haskell"]
        ),
        "html": FileTypeMetadata(
            extensions=[".html"],
            file_format="text",
            mime_types=["text/html"]
        ),
        "iqtree": FileTypeMetadata(
            extensions=[".iqtree"],
            file_format="text",
            mime_types=["text/plain"]
        ),
        "jpeg": FileTypeMetadata(
            extensions=[".jpeg", ".jpg"],
            file_format="binary",
            mime_types=["image/jpeg"]
        ),
        "json": FileTypeMetadata(
            extensions=[".json"],
            file_format="json",
            mime_types=["application/json"]
        ),
        "jsonl": FileTypeMetadata(
            extensions=[".jsonl"],
            file_format="text",
            mime_types=["application/jsonl"]
        ),
        "log": FileTypeMetadata(
            extensions=[".log"],
            file_format="text",
            mime_types=["text/plain"]
        ),
        "md": FileTypeMetadata(
            extensions=[".md", ".markdown"],
            file_format="text",
            mime_types=["text/markdown"]
        ),
        "newick": FileTypeMetadata(
            extensions=[".nwk", ".newick"],
            file_format="text",
            mime_types=["text/x-newick"]
        ),
        "nexus": FileTypeMetadata(
            extensions=[".nex", ".nexus"],
            file_format="text",
            mime_types=["text/x-nexus"]
        ),
        "pdb": FileTypeMetadata(
            extensions=[".pdb"],
            file_format="text",
            mime_types=["chemical/x-pdb"]
        ),
        "pdf": FileTypeMetadata(
            extensions=[".pdf"],
            file_format="binary",
            mime_types=["application/pdf"]
        ),
        "phy": FileTypeMetadata(
            extensions=[".phy"],
            file_format="text",
            mime_types=["text/x-phy"]
        ),
        "text": FileTypeMetadata(
            extensions=[".txt"],
            file_format="text",
            mime_types=["text/plain"]
        ),
        "png": FileTypeMetadata(
            extensions=[".png"],
            file_format="binary",
            mime_types=["image/png"]
        ),
        "rmd": FileTypeMetadata(
            extensions=[".rmd"],
            file_format="text",
            mime_types=["text/x-rmarkdown"]
        ),
        "sam": FileTypeMetadata(
            extensions=[".sam"],
            file_format="text",
            mime_types=["text/plain"]
        ),
        "svg": FileTypeMetadata(
            extensions=[".svg"],
            file_format="text",
            mime_types=["image/svg+xml"]
        ),
        "tiff": FileTypeMetadata(
            extensions=[".tiff", ".tif"],
            file_format="binary",
            mime_types=["image/tiff"]
        ),
        "toml": FileTypeMetadata(
            extensions=[".toml"],
            file_format="text",
            mime_types=["application/toml"]
        ),
        "tsv": FileTypeMetadata(
            extensions=[".tsv"],
            file_format="text",
            mime_types=["text/tab-separated-values"]
        ),
        "vcf": FileTypeMetadata(
            extensions=[".vcf"],
            file_format="text",
            mime_types=["text/x-vcf"]
        ),
        "vcf.gz": FileTypeMetadata(
            extensions=[".vcf.gz"],
            file_format="binary",
            mime_types=["application/gzip"]
        ),
        "xlsx": FileTypeMetadata(
            extensions=[".xlsx"],
            file_format="binary",
            mime_types=["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
        ),
        "xml": FileTypeMetadata(
            extensions=[".xml"],
            file_format="text",
            mime_types=["application/xml"]
        ),
        "yaml": FileTypeMetadata(
            extensions=[".yaml", ".yml"],
            file_format="text",
            mime_types=["application/x-yaml"]
        ),
        "zip": FileTypeMetadata(
            extensions=[".zip"],
            file_format="binary",
            mime_types=["application/zip"]
        ),
    }
    # special types
    allowed["pair"] = FileTypeMetadata(
            extensions=[],
            file_format="array",
            mime_types=[]
    )
    allowed["unknown"] = FileTypeMetadata(
            extensions=[],
            file_format="text",
            mime_types=[]
    )

    # Class-level variable to store the list file types.
    types: ClassVar[tuple[str]] = ()

    # This class-level variable will map file extensions to file type keys.
    extension_to_type: ClassVar[dict[str, str]] = {}
    extensions: ClassVar[list[str]] = []

    def __init__(self) -> None:
        """
        On initialization, build the mapping from file extension to file type.
        """
        self.types = tuple(self.allowed.keys())
        for file_type, metadata in self.allowed.items():
            for ext in metadata.extensions:
                try:
                    self.extension_to_type[ext] = file_type
                except KeyError:
                    # multiple file types share the same extension
                    raise ValueError(f"Extension {ext} is not unique.")
        self.extensions = sorted(self.extension_to_type.keys(), key=len, reverse=True)

    def get_type(self, filename: str) -> str:
        """
        Given a filename, return the corresponding file type based on its extension.
        Checks for multi-part extensions (e.g., '.fastq.gz') by sorting extensions
        by length in descending order so that longer extensions are checked first.
        """
        # Iterate over all known extensions, longest first.
        for ext in self.extensions:
            if filename.endswith(ext):
                return self.extension_to_type[ext]
        return "unknown"

file_types = FileTypes()
FileTypeEnum = Enum("FileTypeEnum", {file_type.upper(): file_type for file_type in file_types.types})
