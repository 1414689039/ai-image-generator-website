# 后端服务启动脚本
# 使用方法：在 PowerShell 中运行 .\start-dev.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动 AI 生图后端服务" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在 worker 目录
if (-not (Test-Path "wrangler.toml")) {
    Write-Host "错误：请在 worker 目录下运行此脚本" -ForegroundColor Red
    exit 1
}

# 检查是否安装了 wrangler
try {
    $wranglerVersion = wrangler --version 2>&1
    Write-Host "✓ Wrangler 已安装: $wranglerVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到 wrangler，请先安装: npm install -g wrangler" -ForegroundColor Red
    exit 1
}

# 检查环境变量
if (-not $env:JWT_SECRET) {
    Write-Host "警告: JWT_SECRET 环境变量未设置" -ForegroundColor Yellow
    Write-Host "正在设置默认 JWT_SECRET（仅用于开发）..." -ForegroundColor Yellow
    $env:JWT_SECRET = "dev-secret-key-change-in-production-$(Get-Random)"
    Write-Host "✓ 已设置 JWT_SECRET" -ForegroundColor Green
} else {
    Write-Host "✓ JWT_SECRET 已设置" -ForegroundColor Green
}

# 检查数据库是否已初始化
Write-Host ""
Write-Host "检查本地数据库..." -ForegroundColor Cyan
$dbCheck = wrangler d1 migrations list ai-image-db --local 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "数据库未初始化，正在初始化..." -ForegroundColor Yellow
    Write-Host "应用数据库迁移..." -ForegroundColor Cyan
    wrangler d1 migrations apply ai-image-db --local
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 数据库初始化成功" -ForegroundColor Green
    } else {
        Write-Host "✗ 数据库初始化失败" -ForegroundColor Red
        Write-Host "请手动运行: wrangler d1 migrations apply ai-image-db --local" -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ 数据库已初始化" -ForegroundColor Green
}

# 启动服务
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动开发服务器..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "服务将在 http://localhost:8787 启动" -ForegroundColor Green
Write-Host "按 Ctrl+C 停止服务" -ForegroundColor Yellow
Write-Host ""

# 启动 wrangler dev
wrangler dev --local

