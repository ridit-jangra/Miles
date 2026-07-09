# -*- mode: python ; coding: utf-8 -*-
import os
import glob
from importlib.util import find_spec
from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = os.path.abspath(os.getcwd())
SERVER_DIR = os.path.join(ROOT, "src", "core", "server")
CV_DIR = os.path.join(ROOT, "src", "core", "cv")

datas = []
binaries = []
hiddenimports = []

for pkg in ("faster_whisper", "ctranslate2", "onnxruntime", "openwakeword", "piper", "cv2"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

# CUDA libs for ctranslate2 GPU inference, bundled in-app. Only cuBLAS is needed:
# ctranslate2's whisper path (transformer matmul/attention) uses cuBLAS but NOT
# cuDNN — verified by running GPU STT with cuDNN removed — so we skip cuDNN's
# ~1GB entirely. ctranslate2 dlopens cuBLAS by name; it resolves from the
# nvidia/cublas/lib SUBPATH where collect_all + the dep scan also place it.
# cu13 variants skipped. Absent on hosts without the wheels (e.g. macOS) —
# load_stt() falls back to CPU.
def _site_packages():
    spec = find_spec("faster_whisper")
    if spec and spec.origin:
        return os.path.dirname(os.path.dirname(spec.origin))
    return None

_sp = _site_packages()
if _sp:
    count = 0
    dest = os.path.join("nvidia", "cublas", "lib")
    for so in glob.glob(os.path.join(_sp, "nvidia", "cublas", "lib", "*.so*")):
        binaries.append((so, dest))
        count += 1
    print(f"[echo-server.spec] bundling {count} cuBLAS libs (cuDNN skipped, ~1GB saved)")
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
    # Vision service (src/core/cv), imported at runtime with a patched sys.path
    "vision",
    "detector",
    "attention",
    "privacy",
]

a = Analysis(
    [os.path.join(SERVER_DIR, "server.py")],
    pathex=[SERVER_DIR, CV_DIR],
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
        "triton",
        "matplotlib",
        "tkinter",
    ],
    noarchive=False,
)

# cuDNN isn't used by ctranslate2's whisper path — drop whatever collect_all and
# the dependency scan pulled in (~1GB) so it doesn't ride along in the bundle.
def _is_cudnn(entry):
    joined = ((entry[0] or "") + "|" + (entry[1] or "")).lower()
    return "libcudnn" in joined or os.sep + "cudnn" + os.sep in joined

a.binaries = [b for b in a.binaries if not _is_cudnn(b)]
a.datas = [d for d in a.datas if not _is_cudnn(d)]

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
