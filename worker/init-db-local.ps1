# 初始化本地 D1 数据库脚本
# 使用方法：在 PowerShell 中运行 .\init-db-local.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  初始化本地 D1 数据库" -ForegroundColor Cyan
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

# 方法1: 尝试使用 database_name
Write-Host "尝试方法 1: 使用 database_name 'ai-image-db'..." -ForegroundColor Cyan
npx wrangler d1 migrations apply ai-image-db --local

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ 数据库初始化成功（方法 1）" -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "方法 1 失败，尝试方法 2: 使用 binding 名称 'DB'..." -ForegroundColor Yellow
npx wrangler d1 migrations apply DB --local

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ 数据库初始化成功（方法 2）" -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "方法 2 失败，尝试方法 3: 直接执行 SQL..." -ForegroundColor Yellow

# 方法3: 直接执行 SQL
if (Test-Path "migrations\0001_initial.sql") {
    Write-Host "执行 SQL 文件: migrations\0001_initial.sql" -ForegroundColor Cyan
    npx wrangler d1 execute ai-image-db --local --file="migrations\0001_initial.sql"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ 数据库初始化成功（方法 3）" -ForegroundColor Green
        exit 0
    }
    
    # 如果使用 database_name 失败，尝试使用 binding
    Write-Host "尝试使用 binding 名称执行 SQL..." -ForegroundColor Yellow
    npx wrangler d1 execute DB --local --file="migrations\0001_initial.sql"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ 数据库初始化成功（方法 3 - binding）" -ForegroundColor Green
        exit 0
    }
}

Write-Host ""
Write-Host "✗ 所有方法都失败了" -ForegroundColor Red
Write-Host ""
Write-Host "请尝试以下步骤：" -ForegroundColor Yellow
Write-Host "1. 确保已安装依赖: npm install" -ForegroundColor Yellow
Write-Host "2. 先启动一次开发服务器: npm run dev" -ForegroundColor Yellow
Write-Host "   这会自动初始化本地数据库" -ForegroundColor Yellow
Write-Host "3. 然后停止服务器，再运行此脚本" -ForegroundColor Yellow
Write-Host ""
exit 1

