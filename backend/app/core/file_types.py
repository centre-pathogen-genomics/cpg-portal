from enum import Enum
from typing import ClassVar

from pydantic import BaseModel, Field


class FileRenderer(BaseModel):
    """A viewer that can draw a file type.

    The name is the identifier shared with the frontend renderer registry.
    External renderers record the project that implements them.
    """

    name: str
    url: str | None = None


# Define a Pydantic model for file type metadata
class FileTypeMetadata(BaseModel):
    extensions: list[str]
    file_format: str
    mime_types: list[str]
    # The type this one specialises, e.g. "tsv" has parent "text". A type
    # inherits its ancestors' renderers, so one file can have several ways to
    # be drawn.
    parent: str | None = None
    renderers: list[FileRenderer] = Field(default_factory=list)


class FileTypes:
    # Class-level dictionary of allowed file types with their metadata.
    allowed: ClassVar[dict[str, FileTypeMetadata]] = {
        "bam": FileTypeMetadata(
            extensions=[".bam"], file_format="binary", mime_types=["application/x-bam"]
        ),
        "beast": FileTypeMetadata(
            extensions=[".trees"],
            file_format="text",
            mime_types=["application/x-beast-trees"],
            parent="text",
        ),
        "bed": FileTypeMetadata(
            extensions=[".bed"],
            file_format="text",
            mime_types=["text/bed"],
            parent="text",
        ),
        "csv": FileTypeMetadata(
            extensions=[".csv"],
            file_format="text",
            mime_types=["text/csv"],
            parent="text",
            renderers=[FileRenderer(name="table")],
        ),
        "docx": FileTypeMetadata(
            extensions=[".docx"],
            file_format="binary",
            mime_types=[
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ],
        ),
        "fasta": FileTypeMetadata(
            extensions=[".fasta", ".fa", ".fna", ".ffn", ".frn", ".faa"],
            file_format="text",
            mime_types=["text/x-fasta"],
            parent="text",
            renderers=[FileRenderer(name="fasta")],
        ),
        "fasta.gz": FileTypeMetadata(
            extensions=[
                ".fasta.gz",
                ".fa.gz",
                ".fna.gz",
                ".ffn.gz",
                ".frn.gz",
                ".faa.gz",
            ],
            file_format="binary",
            mime_types=["application/gzip"],
        ),
        "fastq": FileTypeMetadata(
            extensions=[".fastq", ".fq"],
            file_format="text",
            mime_types=["text/plain"],
            parent="text",
        ),
        "fastq.gz": FileTypeMetadata(
            extensions=[".fastq.gz", ".fq.gz"],
            file_format="binary",
            mime_types=["application/gzip"],
        ),
        "geojson": FileTypeMetadata(
            extensions=[".geojson"],
            file_format="json",
            mime_types=["application/geo+json"],
            parent="json",
        ),
        "gff": FileTypeMetadata(
            extensions=[".gff", ".gff3"],
            file_format="text",
            mime_types=["text/gff"],
            parent="text",
        ),
        "genbank": FileTypeMetadata(
            extensions=[".gb", ".gbk", ".genbank"],
            file_format="text",
            mime_types=["text/x-genbank"],
            parent="text",
            renderers=[FileRenderer(name="genbank")],
        ),
        "gfa": FileTypeMetadata(
            extensions=[".gfa"],
            file_format="text",
            mime_types=["text/x-gfa"],
            parent="text",
            renderers=[
                FileRenderer(
                    name="BandageJS",
                    url="https://github.com/GMOD/BandageJS",
                )
            ],
        ),
        "gfa.gz": FileTypeMetadata(
            extensions=[".gfa.gz"],
            file_format="binary",
            mime_types=["application/gzip"],
            parent="gfa",
        ),
        "graphml": FileTypeMetadata(
            extensions=[".graphml"],
            file_format="text",
            mime_types=["application/graphml+xml"],
            parent="text",
        ),
        "gzip": FileTypeMetadata(
            extensions=[".tgz", ".gz", ".gzip"],
            file_format="binary",
            mime_types=["application/gzip"],
        ),
        "hdf5": FileTypeMetadata(
            extensions=[".h5", ".hdf5"],
            file_format="binary",
            mime_types=["application/x-hdf5"],
        ),
        "hs": FileTypeMetadata(
            extensions=[".hs"],
            file_format="text",
            mime_types=["text/x-haskell"],
            parent="text",
        ),
        "html": FileTypeMetadata(
            extensions=[".html"],
            file_format="text",
            mime_types=["text/html"],
            parent="text",
            renderers=[FileRenderer(name="html")],
        ),
        "iqtree": FileTypeMetadata(
            extensions=[".iqtree"],
            file_format="text",
            mime_types=["text/plain"],
            parent="text",
        ),
        "jpeg": FileTypeMetadata(
            extensions=[".jpeg", ".jpg"],
            file_format="binary",
            mime_types=["image/jpeg"],
            renderers=[FileRenderer(name="image")],
        ),
        "json": FileTypeMetadata(
            extensions=[".json"],
            file_format="json",
            mime_types=["application/json"],
            renderers=[FileRenderer(name="json")],
        ),
        "jsonl": FileTypeMetadata(
            extensions=[".jsonl"],
            file_format="text",
            mime_types=["application/jsonl"],
            parent="text",
        ),
        "log": FileTypeMetadata(
            extensions=[".log"],
            file_format="text",
            mime_types=["text/plain"],
            parent="text",
        ),
        "md": FileTypeMetadata(
            extensions=[".md", ".markdown"],
            file_format="text",
            mime_types=["text/markdown"],
            parent="text",
            renderers=[FileRenderer(name="markdown")],
        ),
        "newick": FileTypeMetadata(
            extensions=[".nwk", ".newick", ".treefile"],
            file_format="text",
            mime_types=["text/x-newick"],
            parent="text",
            renderers=[FileRenderer(name="newick")],
        ),
        "nexus": FileTypeMetadata(
            extensions=[".nex", ".nexus"],
            file_format="text",
            mime_types=["text/x-nexus"],
            parent="text",
        ),
        "pdb": FileTypeMetadata(
            extensions=[".pdb"],
            file_format="text",
            mime_types=["chemical/x-pdb"],
            parent="text",
        ),
        "pdf": FileTypeMetadata(
            extensions=[".pdf"], file_format="binary", mime_types=["application/pdf"]
        ),
        "phy": FileTypeMetadata(
            extensions=[".phy"],
            file_format="text",
            mime_types=["text/x-phy"],
            parent="text",
        ),
        "text": FileTypeMetadata(
            extensions=[".txt"],
            file_format="text",
            mime_types=["text/plain"],
            renderers=[FileRenderer(name="text")],
        ),
        "png": FileTypeMetadata(
            extensions=[".png"],
            file_format="binary",
            mime_types=["image/png"],
            renderers=[FileRenderer(name="image")],
        ),
        "rmd": FileTypeMetadata(
            extensions=[".rmd"],
            file_format="text",
            mime_types=["text/x-rmarkdown"],
            parent="text",
        ),
        "sam": FileTypeMetadata(
            extensions=[".sam"],
            file_format="text",
            mime_types=["text/plain"],
            parent="text",
        ),
        "svg": FileTypeMetadata(
            extensions=[".svg"],
            file_format="text",
            mime_types=["image/svg+xml"],
            parent="text",
            renderers=[FileRenderer(name="image")],
        ),
        "tiff": FileTypeMetadata(
            extensions=[".tiff", ".tif"],
            file_format="binary",
            mime_types=["image/tiff"],
            renderers=[FileRenderer(name="image")],
        ),
        "toml": FileTypeMetadata(
            extensions=[".toml"],
            file_format="text",
            mime_types=["application/toml"],
            parent="text",
        ),
        "tsv": FileTypeMetadata(
            extensions=[".tsv"],
            file_format="text",
            mime_types=["text/tab-separated-values"],
            parent="text",
            renderers=[FileRenderer(name="table")],
        ),
        "vega": FileTypeMetadata(
            extensions=[".vg", ".vega", ".vg.json"],
            file_format="json",
            mime_types=["application/json"],
            parent="json",
            renderers=[FileRenderer(name="vega")],
        ),
        "vega-lite": FileTypeMetadata(
            extensions=[".vl", ".vega-lite", ".vl.json"],
            file_format="json",
            mime_types=["application/json"],
            parent="json",
            renderers=[FileRenderer(name="vega")],
        ),
        "vcf": FileTypeMetadata(
            extensions=[".vcf"],
            file_format="text",
            mime_types=["text/x-vcf"],
            parent="text",
        ),
        "vcf.gz": FileTypeMetadata(
            extensions=[".vcf.gz"],
            file_format="binary",
            mime_types=["application/gzip"],
        ),
        "xlsx": FileTypeMetadata(
            extensions=[".xlsx"],
            file_format="binary",
            mime_types=[
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ],
        ),
        "xml": FileTypeMetadata(
            extensions=[".xml"],
            file_format="text",
            mime_types=["application/xml"],
            parent="text",
        ),
        "yaml": FileTypeMetadata(
            extensions=[".yaml", ".yml"],
            file_format="text",
            mime_types=["application/x-yaml"],
            parent="text",
        ),
        "zip": FileTypeMetadata(
            extensions=[".zip"], file_format="binary", mime_types=["application/zip"]
        ),
    }
    # special types
    allowed["pair"] = FileTypeMetadata(
        extensions=[], file_format="array", mime_types=[]
    )
    allowed["unknown"] = FileTypeMetadata(
        extensions=[], file_format="text", mime_types=[]
    )

    # Store the list of file types and the extension lookup on the instance.
    types: tuple[str, ...] = ()
    extension_to_type: dict[str, str] = {}
    extensions: list[str] = []

    def __init__(self) -> None:
        """
        On initialization, validate the hierarchy and build the extension map.
        """
        self._validate_hierarchy()
        self.types = tuple(self.allowed.keys())
        self.extension_to_type = {}
        for file_type, metadata in self.allowed.items():
            for ext in metadata.extensions:
                if ext in self.extension_to_type:
                    raise ValueError(f"Extension {ext} is not unique.")
                self.extension_to_type[ext] = file_type
        self.extensions = sorted(self.extension_to_type.keys(), key=len, reverse=True)

    def _validate_hierarchy(self) -> None:
        """Ensure every parent exists and the parent links form no cycles."""
        for file_type, metadata in self.allowed.items():
            seen = {file_type}
            parent = metadata.parent
            while parent is not None:
                if parent not in self.allowed:
                    raise ValueError(
                        f"File type {file_type!r} has unknown parent {parent!r}."
                    )
                if parent in seen:
                    raise ValueError(
                        f"File type hierarchy contains a cycle at {parent!r}."
                    )
                seen.add(parent)
                parent = self.allowed[parent].parent

    def get_ancestors(self, file_type: str) -> list[str]:
        """Return a type's ancestors, nearest parent first."""
        ancestors: list[str] = []
        metadata = self.allowed.get(file_type)
        while metadata is not None and metadata.parent is not None:
            ancestors.append(metadata.parent)
            metadata = self.allowed.get(metadata.parent)
        return ancestors

    def get_children(self, file_type: str) -> list[str]:
        """Return the direct children of a type."""
        return [
            name
            for name, metadata in self.allowed.items()
            if metadata.parent == file_type
        ]

    def get_descendants(self, file_type: str) -> list[str]:
        """Return every type below a type, nearest children first."""
        descendants: list[str] = []
        for child in self.get_children(file_type):
            descendants.append(child)
            descendants.extend(self.get_descendants(child))
        return descendants

    def is_subtype(self, file_type: str, parent: str) -> bool:
        """Whether a type is the same as, or below, another type."""
        return file_type == parent or parent in self.get_ancestors(file_type)

    def get_renderers(self, file_type: str) -> list[FileRenderer]:
        """Return the renderers for a type, most specific first.

        A type's own renderers come before those inherited from its ancestors,
        so a GFA file offers BandageJS and can still fall back to the text
        renderer from its ``text`` parent.
        """
        renderers: list[FileRenderer] = []
        seen: set[str] = set()
        for type_name in (file_type, *self.get_ancestors(file_type)):
            metadata = self.allowed.get(type_name)
            if metadata is None:
                continue
            for renderer in metadata.renderers:
                if renderer.name in seen:
                    continue
                seen.add(renderer.name)
                renderers.append(renderer)
        return renderers

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
FileTypeEnum = Enum(  # type: ignore[misc]
    "FileTypeEnum", {file_type.upper(): file_type for file_type in file_types.types}
)
