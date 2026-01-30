# 运行数据库迁移脚本
# 使用方法：在 PowerShell 中运行 .\run-migration.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  运行 D1 数据库迁移" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 确保在 worker 目录
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# 检查 wrangler.toml 是否存在
if (-not (Test-Path "wrangler.toml")) {
    Write-Host "错误：找不到 wrangler.toml 文件" -ForegroundColor Red
    exit 1
}

Write-Host "当前目录: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# 尝试使用 wrangler 4.x
Write-Host "尝试使用 wrangler 4.x 运行迁移..." -ForegroundColor Cyan
npx wrangler@latest d1 migrations apply ai-image-db --local

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "尝试使用 binding 名称..." -ForegroundColor Yellow
    npx wrangler@latest d1 migrations apply DB --local
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "错误：迁移失败" -ForegroundColor Red
        Write-Host "请检查 wrangler.toml 配置是否正确" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "✓ 迁移完成" -ForegroundColor Green
