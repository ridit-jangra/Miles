import hashlib
import json
import tomllib
from pathlib import Path

from miles.env import PLUGINS_DIR, USER_PLUGINS_DIR

TRUST_FILE = USER_PLUGINS_DIR.parent / "trust.json"

def fingerprint(folder: Path) -> str:
    h = hashlib.sha256()
    files = sorted(p for p in folder.rglob("*") if p.is_file() and "__pycache__" not in p.parts and ".git" not in p.parts)
    for p in files:
        h.update(str(p.relative_to(folder)).encode()); h.update(p.read_bytes())
    return h.hexdigest()

def _load() -> dict:
    try: return json.loads(TRUST_FILE.read_text())
    except (OSError, ValueError): return {}

def state(folder: Path) -> str:
    saved = _load().get(folder.name)
    return "new" if not saved else "approved" if saved == fingerprint(folder) else "changed"

def approve(folder: Path) -> None:
    data = _load(); data[folder.name] = fingerprint(folder)
    TRUST_FILE.parent.mkdir(parents=True, exist_ok=True)
    TRUST_FILE.write_text(json.dumps(data, indent=2))

def describe(folder: Path) -> dict:
    meta = tomllib.loads((folder / "plugin.toml").read_text())
    return {
        "name": folder.name,
        "state": state(folder),
        "description": meta.get("description", ""),
        "permissions": [k for k, v in meta.get("permissions", {}).items() if v],
        "dependencies": meta.get("dependencies", {}).get("python", []),
        "servers": [
            {"name": n, "run": " ".join([s.get("command") or s.get("url", ""), *s.get("args", [])])}
            for n, s in meta.get("mcp", {}).items()
        ],
    }


def trusted(folder: Path) -> bool:
    return folder.parent == PLUGINS_DIR or state(folder) == "approved"
