import os
import re
import subprocess
import shutil
from pathlib import Path


def _runtime_root() -> Path:
    env = os.environ.get("CTRACK_RESOURCES_PATH")
    if env:
        return Path(env)
    modules_dir = Path(__file__).resolve().parent
    python_dir = modules_dir.parent
    return python_dir.parent / "resources"


def get_ffmpeg_path():
    """
    Prefer bundled FFmpeg (installer runtime / resources/bin). Never require a system install.
    """
    modules_dir = os.path.dirname(os.path.abspath(__file__))
    python_dir = os.path.dirname(modules_dir)
    project_root = os.path.dirname(python_dir)
    resources_path = os.environ.get("CTRACK_RESOURCES_PATH") or ""

    candidates = [
        os.path.join(resources_path, "runtime", "ffmpeg", "ffmpeg.exe") if resources_path else "",
        os.path.join(resources_path, "bin", "ffmpeg.exe") if resources_path else "",
        os.path.join(project_root, "resources", "runtime", "ffmpeg", "ffmpeg.exe"),
        os.path.join(project_root, "resources", "bin", "ffmpeg.exe"),
        os.path.join(python_dir, "..", "resources", "runtime", "ffmpeg", "ffmpeg.exe"),
    ]
    for candidate in candidates:
        if candidate and os.path.isfile(os.path.normpath(candidate)):
            return os.path.normpath(candidate)

    bundled = shutil.which("ffmpeg")
    if bundled:
        return bundled
    return "ffmpeg"


def get_oiiotool_path() -> str:
    root = _runtime_root()
    for candidate in (
        root / "runtime" / "oiio" / "oiiotool.exe",
        root / "runtime" / "oiio" / "bin" / "oiiotool.exe",
        root / "oiio" / "oiiotool.exe",
    ):
        if candidate.is_file():
            return str(candidate)
    which = shutil.which("oiiotool")
    return which or "oiiotool"


def get_oiio_runtime_dir():
    tool = Path(get_oiiotool_path())
    if tool.is_file():
        return tool.parent
    root = _runtime_root() / "runtime" / "oiio"
    return root if root.is_dir() else None


def get_ocio_config_path(explicit=None):
    if explicit and os.path.isfile(explicit):
        return explicit
    env_path = os.environ.get("CTRACK_OCIO_CONFIG") or os.environ.get("OCIO")
    if env_path and os.path.isfile(env_path):
        return env_path
    root = _runtime_root()
    bundled = [
        root / "runtime" / "ocio" / "aces_1.2" / "config.ocio",
        root / "runtime" / "ocio" / "cg-config-v1.0.0_aces-v1.3_ocio-v2.1.ocio",
        root / "runtime" / "ocio" / "cg-config-v2.1.0_aces-v1.3_ocio-v2.2.ocio",
    ]
    for path in bundled:
        if path.is_file():
            return str(path)
    return None


def _oiio_env(ocio_config=None):
    env = os.environ.copy()
    oiio_dir = get_oiio_runtime_dir()
    if oiio_dir:
        extra = [str(oiio_dir), str(oiio_dir / "bin")]
        env["PATH"] = os.pathsep.join(extra + [env.get("PATH", "")])
    ocio = get_ocio_config_path(ocio_config)
    if ocio:
        env["OCIO"] = ocio
    return env


def run_oiiotool(cmd_args, log_callback=None, ocio_config=None):
    exe = get_oiiotool_path()
    process = subprocess.Popen(
        [exe] + list(cmd_args),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        bufsize=1,
        env=_oiio_env(ocio_config),
    )
    stderr_lines = []
    while True:
        line = process.stderr.readline()
        if not line:
            break
        stderr_lines.append(line)
        if log_callback and line.strip():
            log_callback(line.strip())
    process.wait()
    stdout, rest = process.communicate()
    if rest:
        stderr_lines.append(rest)
    return process.returncode, stdout or "", "".join(stderr_lines)


def get_threads_for_parallel():
    """Returns thread count for FFmpeg when running 2 processes in parallel (~50% CPU each)."""
    n = os.cpu_count() or 4
    return max(1, n // 2)

def run_ffmpeg(cmd_args, log_callback=None):
    """
    Runs an ffmpeg command. If log_callback is provided, it's called with stderr lines.
    Deduplicates frame= progress lines (FFmpeg often logs same frame twice) — only log when frame number changes.
    """
    ffmpeg_exe = get_ffmpeg_path()
    full_cmd = [ffmpeg_exe] + cmd_args
    
    process = subprocess.Popen(
        full_cmd, 
        stdout=subprocess.PIPE, 
        stderr=subprocess.PIPE, 
        universal_newlines=True,
        bufsize=1
    )
    
    stderr_full = []
    last_frame = -1
    frame_re = re.compile(r'frame=\s*(\d+)')
    
    while True:
        line = process.stderr.readline()
        if not line:
            break
        stderr_full.append(line)
        if log_callback:
            stripped = line.strip()
            if stripped:
                m = frame_re.search(stripped)
                if m:
                    frame = int(m.group(1))
                    if frame != last_frame:
                        last_frame = frame
                        log_callback(stripped)
                else:
                    log_callback(stripped)
            
    process.wait()
    stdout, _ = process.communicate()
    return process.returncode, stdout, "".join(stderr_full)
