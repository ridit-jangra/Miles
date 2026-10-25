import hashlib
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path

from loguru import logger

from miles.env import DEPS_DIR

MARKER = ".miles-deps"


def requirements(folder: Path) -> list[str]:
    try:
        meta = tomllib.loads((folder / "plugin.toml").read_text())
    except (OSError, ValueError):
        return []
    reqs = meta.get("dependencies", {}).get("python", [])
    return [r.strip() for r in reqs if isinstance(r, str) and r.strip()]


def target_dir(folder: Path) -> Path:
    return DEPS_DIR / folder.name


def _stamp(reqs: list[str]) -> str:
    return hashlib.sha256("\n".join(sorted(reqs)).encode()).hexdigest()


def needs_install(folder: Path) -> bool:
    reqs = requirements(folder)
    if not reqs:
        return False
    marker = target_dir(folder) / MARKER
    return not marker.exists() or marker.read_text() != _stamp(reqs)


def install(folder: Path) -> bool:
    reqs = requirements(folder)
    if any(r.startswith("-") for r in reqs):
        logger.error(f"Plugin {folder.name}: dependencies can't start with '-', skipping the install")
        return False
    uv = shutil.which("uv")
    if not uv:
        logger.error(f"Plugin {folder.name}: uv was not found, so its dependencies can't be installed")
        return False
    target = target_dir(folder)
    shutil.rmtree(target, ignore_errors=True)
    result = subprocess.run(
        [uv, "pip", "install", "--quiet", "--target", str(target), "--python", sys.executable, *reqs],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        logger.error(f"Plugin {folder.name}: installing {reqs} failed:\n{result.stderr.strip()}")
        shutil.rmtree(target, ignore_errors=True)
        return False
    (target / MARKER).write_text(_stamp(reqs))
    logger.info(f"Installed {len(reqs)} dependencies for plugin {folder.name}")
    return True


def activate(folder: Path) -> None:
    target = target_dir(folder)
    if requirements(folder) and needs_install(folder):
        logger.warning(f"Plugin {folder.name} has dependencies that are not installed yet")
    if target.is_dir() and str(target) not in sys.path:
        sys.path.insert(0, str(target))
