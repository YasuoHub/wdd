# CloudFunctions batch deploy script (PowerShell)
# Recursively finds all dirs with package.json under cloudfunctions, deploys each by package.json "name".

$ErrorActionPreference = "Continue"
$ENV_ID = "wdd-2grpiy1r6f9f4cf2"
$SkipNames = @("config")

$projectRoot = (Get-Item $PSScriptRoot).Parent.FullName
$cloudFunctionsPath = Join-Path $projectRoot "cloudfunctions"

if (-not (Get-Command tcb -ErrorAction SilentlyContinue)) {
    Write-Host "Error: CloudBase CLI not installed. Run: npm install -g @cloudbase/cli" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $cloudFunctionsPath)) {
    Write-Host "Error: Directory not found: $cloudFunctionsPath" -ForegroundColor Red
    exit 1
}

Write-Host "================================"
Write-Host "CloudFunctions batch deploy"
Write-Host "================================"
Write-Host "Env: $ENV_ID"
Write-Host "Root: $cloudFunctionsPath"
Write-Host ""

$allPkg = Get-ChildItem -Path $cloudFunctionsPath -Recurse -Filter "package.json" -File
$dirs = $allPkg | ForEach-Object { $_.DirectoryName } | Sort-Object -Unique
$failed = @()
$deployed = 0

foreach ($dir in $dirs) {
    Push-Location $dir
    try {
        $pkgPath = Join-Path $dir "package.json"
        $pkg = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $name = $pkg.name
        if ([string]::IsNullOrWhiteSpace($name)) {
            Write-Host "[Skip]" $dir "- package.json has no name" -ForegroundColor Yellow
            continue
        }
        if ($SkipNames -contains $name) {
            Write-Host "[Skip]" $name "- in skip list" -ForegroundColor Yellow
            continue
        }
        $relPath = "cloudfunctions" + $dir.Substring($cloudFunctionsPath.Length).Replace("\", "/")
        Write-Host "[Deploy]" $name $relPath "..."
        $result = & tcb fn deploy $name -e $ENV_ID --force 2>&1
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            $failed += [PSCustomObject]@{ Name = $name; Dir = $relPath; Output = $result }
            Write-Host "  Failed, exit code:" $exitCode -ForegroundColor Red
        } else {
            $deployed++
            Write-Host "  OK" -ForegroundColor Green
        }
    } catch {
        $failed += [PSCustomObject]@{ Name = "?"; Dir = $dir; Output = $_.Exception.Message }
        Write-Host "  Error:" $_.Exception.Message -ForegroundColor Red
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "================================"
$summary = "Done. Success: " + $deployed + ", Failed: " + $failed.Count
Write-Host $summary
Write-Host "================================"
if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed list:" -ForegroundColor Red
    foreach ($f in $failed) {
        Write-Host "  -" $f.Name $f.Dir
    }
    exit 1
}
