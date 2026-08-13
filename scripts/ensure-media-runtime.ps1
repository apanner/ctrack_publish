# Bundle FFmpeg + OpenImageIO + OCIO into resources/runtime (same as ctrack_publish_web).
param(
  [string]$TargetRoot = "",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$destRoot = if ($TargetRoot) { $TargetRoot } else { Join-Path $repoRoot "resources" }
$runtimeRoot = Join-Path $destRoot "runtime"
$ffmpegDir = Join-Path $runtimeRoot "ffmpeg"
$oiioDir = Join-Path $runtimeRoot "oiio"
$ocioDir = Join-Path $runtimeRoot "ocio"
$cacheDir = Join-Path $repoRoot ".cache"
New-Item -ItemType Directory -Force -Path $cacheDir, $ffmpegDir, $oiioDir, $ocioDir | Out-Null

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Download-File([string[]]$Urls, [string]$Destination, [int64]$MinBytes = 1) {
  if ((Test-Path $Destination) -and -not $Force) {
    $cached = Get-Item $Destination
    if ($cached.Length -ge $MinBytes) {
      Write-Host "[ctrack] Using cached $(Split-Path $Destination -Leaf)"
      return
    }
    Remove-Item $Destination -Force
  }
  foreach ($url in $Urls) {
    try {
      Write-Host "[ctrack] Downloading $url"
      Invoke-WebRequest -Uri $url -OutFile $Destination -UseBasicParsing
      if ((Get-Item $Destination).Length -ge $MinBytes) { return }
    } catch {
      Write-Warning $_.Exception.Message
    }
  }
  throw "Download failed: $Destination"
}

function Ensure-Ffmpeg {
  if ((Test-Path (Join-Path $ffmpegDir "ffmpeg.exe")) -and -not $Force) {
    Write-Host "[ctrack] FFmpeg ready: $ffmpegDir"
    return
  }
  $zip = Join-Path $cacheDir "ffmpeg-win64-gpl.zip"
  $extract = Join-Path $cacheDir "ffmpeg-extract"
  Download-File @(
    "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.1-latest-win64-gpl-7.1.zip",
    "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
  ) $zip 10MB
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $extract -Force
  $ffmpegExe = Get-ChildItem $extract -Recurse -Filter ffmpeg.exe | Select-Object -First 1
  $ffprobeExe = Get-ChildItem $extract -Recurse -Filter ffprobe.exe | Select-Object -First 1
  if (-not $ffmpegExe) { throw "ffmpeg.exe missing" }
  Copy-Item $ffmpegExe.FullName (Join-Path $ffmpegDir "ffmpeg.exe") -Force
  if ($ffprobeExe) { Copy-Item $ffprobeExe.FullName (Join-Path $ffmpegDir "ffprobe.exe") -Force }
  Get-ChildItem $ffmpegExe.Directory -Filter "*.dll" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $ffmpegDir $_.Name) -Force
  }
  Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "[ctrack] FFmpeg bundled: $ffmpegDir"
}

function Ensure-Oiio {
  $existing = Get-ChildItem $oiioDir -Recurse -Filter oiiotool.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existing -and -not $Force) {
    Write-Host "[ctrack] OpenImageIO ready: $($existing.FullName)"
    return
  }
  $zip = Join-Path $cacheDir "OpenImageIO.zip"
  $extract = Join-Path $cacheDir "oiio-extract"
  Download-File @("https://github.com/pitvfx/OpenImageIO/releases/download/v1.0.0/OpenImageIO.zip") $zip 1MB
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $extract -Force
  $found = Get-ChildItem $extract -Recurse -Filter oiiotool.exe | Select-Object -First 1
  if (-not $found) { throw "oiiotool.exe missing" }
  $oiioRoot = if ($found.Directory.Name -eq "bin") { $found.Directory.Parent } else { $found.Directory }
  if (Test-Path $oiioDir) { Remove-Item $oiioDir -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $oiioDir | Out-Null
  Get-ChildItem $oiioRoot | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $oiioDir $_.Name) -Recurse -Force
  }
  Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "[ctrack] OpenImageIO bundled: $oiioDir"
}

function Ensure-Ocio {
  $aces = Join-Path $ocioDir "aces_1.2\config.ocio"
  if ((Test-Path $aces) -and -not $Force) {
    Write-Host "[ctrack] OCIO aces_1.2 ready"
    return
  }
  $nukeAces = @(
    "C:\Program Files\Nuke15.1v4\plugins\OCIOConfigs\configs\aces_1.2",
    "C:\Program Files\Nuke14.0v5\plugins\OCIOConfigs\configs\aces_1.2",
    "C:\Program Files\Nuke13.2v5\plugins\OCIOConfigs\configs\aces_1.2"
  )
  foreach ($src in $nukeAces) {
    if (Test-Path (Join-Path $src "config.ocio")) {
      $dest = Join-Path $ocioDir "aces_1.2"
      if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
      Copy-Item $src $dest -Recurse -Force
      Write-Host "[ctrack] OCIO aces_1.2 copied from Nuke"
      return
    }
  }
  $cg = Join-Path $ocioDir "cg-config-v2.1.0_aces-v1.3_ocio-v2.2.ocio"
  Download-File @(
    "https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES/releases/download/v2.1.0-v2.2.0/cg-config-v2.1.0_aces-v1.3_ocio-v2.2.ocio"
  ) $cg 1KB
  Write-Host "[ctrack] OCIO cg-config bundled (Nuke aces_1.2 not found on builder)"
}

Write-Host "[ctrack] Bundling media runtime under $runtimeRoot"
Ensure-Ffmpeg
Ensure-Oiio
Ensure-Ocio
Write-Host "[ctrack] Runtime ready: FFmpeg + OIIO + OCIO"
