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
        "avi": FileTypeMetadata(
            extensions=[".avi"],
            file_format="binary",
            mime_types=["video/x-msvideo"]
        ),
        "bam": FileTypeMetadata(
            extensions=[".bam"],
            file_format="binary",
            mime_types=["application/x-bam"]
        ),
        "bat": FileTypeMetadata(
            extensions=[".bat"],
            file_format="text",
            mime_types=["text/plain"]
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
        "bmp": FileTypeMetadata(
            extensions=[".bmp"],
            file_format="binary",
            mime_types=["image/bmp"]
        ),
        "c": FileTypeMetadata(
            extensions=[".c"],
            file_format="text",
            mime_types=["text/x-c"]
        ),
        "cpp": FileTypeMetadata(
            extensions=[".cpp"],
            file_format="text",
            mime_types=["text/x-c++src"]
        ),
        "css": FileTypeMetadata(
            extensions=[".css"],
            file_format="text",
            mime_types=["text/css"]
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
        "epub": FileTypeMetadata(
            extensions=[".epub"],
            file_format="binary",
            mime_types=["application/epub+zip"]
        ),
        "fasta": FileTypeMetadata(
            extensions=[".fasta"],
            file_format="text",
            mime_types=["text/plain"]
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
        "flac": FileTypeMetadata(
            extensions=[".flac"],
            file_format="binary",
            mime_types=["audio/flac"]
        ),
        "geojson": FileTypeMetadata(
            extensions=[".geojson"],
            file_format="json",
            mime_types=["application/geo+json"]
        ),
        "gexf": FileTypeMetadata(
            extensions=[".gexf"],
            file_format="text",
            mime_types=["application/xml"]
        ),
        "gff": FileTypeMetadata(
            extensions=[".gff", ".gff3"],
            file_format="text",
            mime_types=["text/gff"]
        ),
        "go": FileTypeMetadata(
            extensions=[".go"],
            file_format="text",
            mime_types=["text/plain"]
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
        "ical": FileTypeMetadata(
            extensions=[".ical", ".ics", ".ifb", ".icalendar"],
            file_format="text",
            mime_types=["text/calendar"]
        ),
        "ico": FileTypeMetadata(
            extensions=[".ico"],
            file_format="binary",
            mime_types=["image/x-icon"]
        ),
        "ini": FileTypeMetadata(
            extensions=[".ini"],
            file_format="text",
            mime_types=["text/plain"]
        ),
        "ipynb": FileTypeMetadata(
            extensions=[".ipynb"],
            file_format="json",
            mime_types=["application/x-ipynb+json"]
        ),
        "iqtree": FileTypeMetadata(
            extensions=[".iqtree"],
            file_format="text",
            mime_types=["text/plain"]
        ),
        "java": FileTypeMetadata(
            extensions=[".java"],
            file_format="text",
            mime_types=["text/x-java-source"]
        ),
        "jpeg": FileTypeMetadata(
            extensions=[".jpeg", ".jpg"],
            file_format="binary",
            mime_types=["image/jpeg"]
        ),
        "js": FileTypeMetadata(
            extensions=[".js", ".mjs"],
            file_format="text",
            mime_types=["application/javascript"]
        ),
        "jsmap": FileTypeMetadata(
            extensions=[".map"],
            file_format="json",
            mime_types=["application/json"]
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
        "kt": FileTypeMetadata(
            extensions=[".kt"],
            file_format="text",
            mime_types=["text/x-kotlin"]
        ),
        "log": FileTypeMetadata(
            extensions=[".log"],
            file_format="text",
            mime_types=["text/plain"]
        ),
        "manifest": FileTypeMetadata(
            extensions=[".manifest"],
            file_format="text",
            mime_types=["text/cache-manifest"]
        ),
        "matlab": FileTypeMetadata(
            extensions=[".m"],
            file_format="text",
            mime_types=["text/x-matlab"]
        ),
        "md": FileTypeMetadata(
            extensions=[".md", ".markdown"],
            file_format="text",
            mime_types=["text/markdown"]
        ),
        "mp3": FileTypeMetadata(
            extensions=[".mp3"],
            file_format="binary",
            mime_types=["audio/mpeg"]
        ),
        "mp4": FileTypeMetadata(
            extensions=[".mp4"],
            file_format="binary",
            mime_types=["video/mp4"]
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
        "obj": FileTypeMetadata(
            extensions=[".obj"],
            file_format="text",
            mime_types=["text/plain"]
        ),
        "otf": FileTypeMetadata(
            extensions=[".otf"],
            file_format="binary",
            mime_types=["font/otf"]
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
        "php": FileTypeMetadata(
            extensions=[".php"],
            file_format="text",
            mime_types=["application/x-httpd-php"]
        ),
        "phy": FileTypeMetadata(
            extensions=[".phy"],
            file_format="text",
            mime_types=["text/x-phy"]
        ),
        "pl": FileTypeMetadata(
            extensions=[".pl"],
            file_format="text",
            mime_types=["text/x-perl"]
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
        "pptx": FileTypeMetadata(
            extensions=[".pptx"],
            file_format="binary",
            mime_types=["application/vnd.openxmlformats-officedocument.presentationml.presentation"]
        ),
        "py": FileTypeMetadata(
            extensions=[".py"],
            file_format="text",
            mime_types=["text/x-python", "application/x-python-code"]
        ),
        "r": FileTypeMetadata(
            extensions=[".r"],
            file_format="text",
            mime_types=["text/x-r"]
        ),
        "rar": FileTypeMetadata(
            extensions=[".rar"],
            file_format="binary",
            mime_types=["application/x-rar-compressed"]
        ),
        "rb": FileTypeMetadata(
            extensions=[".rb"],
            file_format="text",
            mime_types=["text/x-ruby"]
        ),
        "rmd": FileTypeMetadata(
            extensions=[".rmd"],
            file_format="text",
            mime_types=["text/x-rmarkdown"]
        ),
        "rs": FileTypeMetadata(
            extensions=[".rs"],
            file_format="text",
            mime_types=["text/x-rustsrc"]
        ),
        "sam": FileTypeMetadata(
            extensions=[".sam"],
            file_format="text",
            mime_types=["text/plain"]
        ),
        "scala": FileTypeMetadata(
            extensions=[".scala"],
            file_format="text",
            mime_types=["text/x-scala"]
        ),
        "sh": FileTypeMetadata(
            extensions=[".sh"],
            file_format="text",
            mime_types=["text/x-shellscript"]
        ),
        "sql": FileTypeMetadata(
            extensions=[".sql"],
            file_format="text",
            mime_types=["text/x-sql"]
        ),
        "stl": FileTypeMetadata(
            extensions=[".stl"],
            file_format="binary",
            mime_types=["model/stl"]
        ),
        "svg": FileTypeMetadata(
            extensions=[".svg"],
            file_format="text",
            mime_types=["image/svg+xml"]
        ),
        "tex": FileTypeMetadata(
            extensions=[".tex"],
            file_format="text",
            mime_types=["text/x-tex"]
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
        "ttf": FileTypeMetadata(
            extensions=[".ttf"],
            file_format="binary",
            mime_types=["font/ttf"]
        ),
        "vcf": FileTypeMetadata(
            extensions=[".vcf"],
            file_format="text",
            mime_types=["text/x-vcf"]
        ),
        "vue": FileTypeMetadata(
            extensions=[".vue"],
            file_format="text",
            mime_types=["text/plain"]
        ),
        "wasm": FileTypeMetadata(
            extensions=[".wasm"],
            file_format="binary",
            mime_types=["application/wasm"]
        ),
        "wav": FileTypeMetadata(
            extensions=[".wav"],
            file_format="binary",
            mime_types=["audio/wav"]
        ),
        "wheel": FileTypeMetadata(
            extensions=[".whl"],
            file_format="binary",
            mime_types=["octet/stream", "application/x-wheel+zip"]
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
        "unknown": FileTypeMetadata(
            extensions=[],
            file_format="text",
            mime_types=[]
        ),
    }

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
