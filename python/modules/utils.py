import os
import re
import subprocess
import shutil

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
