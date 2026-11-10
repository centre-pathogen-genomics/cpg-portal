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

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="cpg-runner",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)
