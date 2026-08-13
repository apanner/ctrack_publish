# Bundle FFmpeg (+ optional OIIO/OCIO) into resources/runtime — same idea as ctrack_publish_web.
param(
  [string]$TargetRoot = "",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$destRoot = if ($TargetRoot) { $TargetRoot } else { Join-Path $repoRoot "resources" }
$runtimeRoot = Join-Path $destRoot "runtime"
$ffmpegDir = Join-Path $runtimeRoot "ffmpeg"
$cacheDir = Join-Path $repoRoot ".cache"
New-Item -ItemType Directory -Force -Path $cacheDir, $ffmpegDir | Out-Null

if ((Test-Path (Join-Path $ffmpegDir "ffmpeg.exe")) -and -not $Force) {
  Write-Host "[ctrack] Bundled FFmpeg already present: $ffmpegDir"
  exit 0
}

$zip = Join-Path $cacheDir "ffmpeg-win64-gpl.zip"
$extract = Join-Path $cacheDir "ffmpeg-extract"
$urls = @(
  "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.1-latest-win64-gpl-7.1.zip",
  "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ok = $false
foreach ($url in $urls) {
  try {
    Write-Host "[ctrack] Downloading FFmpeg: $url"
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    $ok = $true
    break
  } catch {
    Write-Warning $_.Exception.Message
  }
}
if (-not $ok) { throw "Could not download FFmpeg" }

if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
New-Item -ItemType Directory -Force -Path $extract | Out-Null
Expand-Archive -Path $zip -DestinationPath $extract -Force
$ffmpegExe = Get-ChildItem $extract -Recurse -Filter ffmpeg.exe | Select-Object -First 1
$ffprobeExe = Get-ChildItem $extract -Recurse -Filter ffprobe.exe | Select-Object -First 1
if (-not $ffmpegExe) { throw "ffmpeg.exe missing from archive" }
Copy-Item $ffmpegExe.FullName (Join-Path $ffmpegDir "ffmpeg.exe") -Force
if ($ffprobeExe) { Copy-Item $ffprobeExe.FullName (Join-Path $ffmpegDir "ffprobe.exe") -Force }
Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "[ctrack] FFmpeg bundled at $ffmpegDir"
