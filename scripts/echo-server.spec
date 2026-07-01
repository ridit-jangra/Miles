# -*- mode: python ; coding: utf-8 -*-
import os
import glob
from importlib.util import find_spec
from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = os.path.abspath(os.getcwd())
SERVER_DIR = os.path.join(ROOT, "src", "core", "server")

datas = []
binaries = []
hiddenimports = []

for pkg in ("faster_whisper", "ctranslate2", "onnxruntime", "openwakeword", "piper"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

# CUDA libs for ctranslate2 GPU inference (cuBLAS + cuDNN). The nvidia-*-cu12
# wheels install .so files under site-packages/nvidia/**/lib but are NOT
# importable ("import nvidia" fails), so collect_dynamic_libs finds nothing.
# Glob them off disk instead, and drop them at the bundle ROOT ("."), which is
# on the loader path — the nvidia/**/lib/ subpath is not, so a preserved layout
# would still be unfindable. ctranslate2 4.x needs cu12 (libcublas.so.12,
# libcudnn*.so.9); the cu13 variants are skipped. Absent on hosts without the
# wheels (e.g. macOS) — load_stt() then falls back to CPU.
def _site_packages():
    spec = find_spec("faster_whisper")
    if spec and spec.origin:
        return os.path.dirname(os.path.dirname(spec.origin))
    return None

_sp = _site_packages()
if _sp:
    cuda_libs = []
    for sub in ("cublas/lib", "cudnn/lib"):
        for so in glob.glob(os.path.join(_sp, "nvidia", sub, "*.so*")):
            cuda_libs.append((so, "."))
    if cuda_libs:
        binaries += cuda_libs
        print(f"[echo-server.spec] bundling {len(cuda_libs)} CUDA libs to bundle root")
    else:
        print("[echo-server.spec] no CUDA libs found — GPU STT will fall back to CPU")
else:
    print("[echo-server.spec] faster_whisper not locatable — skipping CUDA libs")

hiddenimports += collect_submodules("uvicorn")
hiddenimports += [
    "sanitize",
    "scipy.signal",
    "anyio",
    "websockets",
    "httptools",
    "uvicorn.lifespan.on",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
]

a = Analysis(
    [os.path.join(SERVER_DIR, "server.py")],
    pathex=[SERVER_DIR],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        "torch",
        "torchaudio",
        "torchvision",
        "tensorflow",
        "matplotlib",
        "tkinter",
    ],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="server",
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
    name="server",
)
