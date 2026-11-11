# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_submodules

hiddenimports = sorted(
    set(
        collect_submodules("uvicorn")
        + collect_submodules("websockets")
        + [
            "app",
            "app.core",
            "app.core.file_types",
            "app.run_spec",
            "app.sandbox",
        ]
    )
)

a = Analysis(
    ["cpg_runner_main.py"],
    pathex=[".", "../../backend"],
    binaries=[],
    datas=[],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["pytest", "_pytest"],
    noarchive=False,
)
pyz = PYZ(a.pure)

# A one-folder build: the executable next to its libraries. A one-file build
# unpacks itself into a temp directory on every launch, which costs seconds per
# start; this starts in about a second.
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="cpg-runner",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="cpg-runner",
)
