from app.core.file_types import FileTypeEnum, file_types


def test_hierarchy_inherits_parent_renderers() -> None:
    assert file_types.allowed["tsv"].parent == "text"
    assert file_types.is_subtype("tsv", "text")
    assert "tsv" in file_types.get_descendants("text")
    assert [renderer.name for renderer in file_types.get_renderers("tsv")] == [
        "table",
        "text",
    ]


def test_gfa_uses_bandagejs() -> None:
    assert file_types.get_type("assembly.gfa") == "gfa"
    assert file_types.get_type("assembly.gfa.gz") == "gfa.gz"
    assert FileTypeEnum.GFA.value == "gfa"

    renderers = file_types.get_renderers("gfa")
    assert [renderer.name for renderer in renderers] == ["BandageJS", "text"]
    assert renderers[0].url == "https://github.com/GMOD/BandageJS"
