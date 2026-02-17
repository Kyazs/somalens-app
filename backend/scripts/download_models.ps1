<#
.SYNOPSIS
    Downloads all ML model files required by SomaLens backend.
    Run this ONCE before your first Docker build.

.DESCRIPTION
    Downloads to backend/ml_model_cache/:
    - ZoeDepth weights (ZoeD_M12_N.pt) ~1.34 GB
    - MiDaS repository
    - ZoeDepth repository
    - MediaPipe Pose Landmarker Heavy ~30 MB
    - DeepLabV3 ResNet101 weights ~233 MB

.EXAMPLE
    cd backend
    .\scripts\download_models.ps1
#>

$ErrorActionPreference = "Stop"

# Resolve paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $ScriptDir
$CacheDir = Join-Path $BackendDir "ml_model_cache"

# Subdirectories
$ZoeDepthDir = Join-Path $CacheDir "zoedepth\hub\checkpoints"
$MidasDir = Join-Path $CacheDir "zoedepth\hub"
$ZoeRepoDir = Join-Path $CacheDir "zoedepth\hub"
$MediaPipeDir = Join-Path $CacheDir "mediapipe"
$TorchDir = Join-Path $CacheDir "torch"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " SomaLens ML Model Downloader" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Cache directory: $CacheDir"
Write-Host ""

# --- Helper ---
function Download-File {
    param(
        [string]$Url,
        [string]$OutFile,
        [string]$Description
    )

    if (Test-Path $OutFile) {
        $size = (Get-Item $OutFile).Length
        $sizeMB = [math]::Round($size / 1MB, 1)
        Write-Host "[SKIP] $Description already exists ($sizeMB MB)" -ForegroundColor Yellow
        return
    }

    $dir = Split-Path -Parent $OutFile
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    Write-Host "[DOWNLOADING] $Description ..." -ForegroundColor Green
    Write-Host "  URL: $Url"
    Write-Host "  Destination: $OutFile"

    try {
        # Use BITS for large files (supports resume), fallback to Invoke-WebRequest
        $tempFile = "$OutFile.downloading"
        Start-BitsTransfer -Source $Url -Destination $tempFile -DisplayName $Description -ErrorAction Stop
        Move-Item -Path $tempFile -Destination $OutFile -Force
    }
    catch {
        Write-Host "  BITS transfer failed, falling back to Invoke-WebRequest..." -ForegroundColor DarkYellow
        if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
        Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
    }

    $size = (Get-Item $OutFile).Length
    $sizeMB = [math]::Round($size / 1MB, 1)
    Write-Host "[DONE] $Description ($sizeMB MB)" -ForegroundColor Green
}

function Download-AndExtractZip {
    param(
        [string]$Url,
        [string]$TargetDir,
        [string]$ExpectedSubdirPattern,
        [string]$FinalName,
        [string]$Description
    )

    $finalPath = Join-Path $TargetDir $FinalName
    if (Test-Path $finalPath) {
        Write-Host "[SKIP] $Description already exists at $finalPath" -ForegroundColor Yellow
        return
    }

    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }

    $zipFile = Join-Path $env:TEMP "$FinalName.zip"
    $extractDir = Join-Path $env:TEMP "$FinalName-extract"

    Write-Host "[DOWNLOADING] $Description ..." -ForegroundColor Green
    Invoke-WebRequest -Uri $Url -OutFile $zipFile -UseBasicParsing

    Write-Host "  Extracting..."
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
    Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

    # Find the extracted subdirectory
    $subDir = Get-ChildItem -Path $extractDir -Directory | Where-Object { $_.Name -like $ExpectedSubdirPattern } | Select-Object -First 1
    if ($subDir) {
        Move-Item -Path $subDir.FullName -Destination $finalPath -Force
    } else {
        Write-Host "  ERROR: Could not find expected subdirectory matching '$ExpectedSubdirPattern'" -ForegroundColor Red
        Write-Host "  Contents: $(Get-ChildItem $extractDir | Select-Object -ExpandProperty Name)" -ForegroundColor Red
    }

    # Cleanup
    Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
    Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue

    Write-Host "[DONE] $Description" -ForegroundColor Green
}

# =============================================
# 1. ZoeDepth Weights (~1.34 GB)
# =============================================
Download-File `
    -Url "https://github.com/isl-org/ZoeDepth/releases/download/v1.0/ZoeD_M12_N.pt" `
    -OutFile (Join-Path $ZoeDepthDir "ZoeD_M12_N.pt") `
    -Description "ZoeDepth weights (ZoeD_M12_N.pt, ~1.34 GB)"

# =============================================
# 2. MiDaS Repository
# =============================================
Download-AndExtractZip `
    -Url "https://github.com/intel-isl/MiDaS/zipball/master" `
    -TargetDir $MidasDir `
    -ExpectedSubdirPattern "intel-isl-MiDaS-*" `
    -FinalName "intel-isl_MiDaS_master" `
    -Description "MiDaS repository"

# =============================================
# 3. ZoeDepth Repository
# =============================================
Download-AndExtractZip `
    -Url "https://github.com/isl-org/ZoeDepth/zipball/main" `
    -TargetDir $ZoeRepoDir `
    -ExpectedSubdirPattern "isl-org-ZoeDepth-*" `
    -FinalName "isl-org_ZoeDepth_main" `
    -Description "ZoeDepth repository"

# =============================================
# 4. MediaPipe Pose Landmarker Heavy
# =============================================
Download-File `
    -Url "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task" `
    -OutFile (Join-Path $MediaPipeDir "pose_landmarker_heavy.task") `
    -Description "MediaPipe Pose Landmarker Heavy (~30 MB)"

# =============================================
# 5. DeepLabV3 ResNet101 (for prod build)
# =============================================
# This is normally downloaded by PyTorch at runtime; pre-caching avoids build-time network calls
$deeplabUrl = "https://download.pytorch.org/models/deeplabv3_resnet101_coco-586e9e4e.pth"
Download-File `
    -Url $deeplabUrl `
    -OutFile (Join-Path $TorchDir "deeplabv3_resnet101.pth") `
    -Description "DeepLabV3 ResNet101 weights (~233 MB)"

# =============================================
# Summary
# =============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Download Summary" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$allFiles = Get-ChildItem -Path $CacheDir -Recurse -File
$totalSizeMB = [math]::Round(($allFiles | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
Write-Host "Total files: $($allFiles.Count)"
Write-Host "Total size:  $totalSizeMB MB"
Write-Host ""
Write-Host "You can now build Docker images. Models will be volume-mounted (dev) or COPY'd (prod)." -ForegroundColor Green
