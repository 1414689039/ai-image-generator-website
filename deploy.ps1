# 一键部署脚本 (Direct to Cloudflare)
# 此脚本直接将构建产物上传到 Cloudflare，不依赖 GitHub Actions

$ErrorActionPreference = "Stop"

Write-Host "🚀 开始直接部署到 Cloudflare..." -ForegroundColor Cyan

# ---------------------------------------------------------
# 1. 部署后端 (Worker)
# ---------------------------------------------------------
Write-Host "`n📦 [1/2] 正在部署后端 Worker..." -ForegroundColor Yellow
Set-Location "worker"

# 安装依赖 (可选，防止缺失)
# npm install 

# 部署
cmd /c "npm run deploy"
if ($LASTEXITCODE -ne 0) { 
    Write-Error "❌ 后端部署失败"
    exit 1 
}

Set-Location ".."

# ---------------------------------------------------------
# 2. 部署前端 (Pages)
# ---------------------------------------------------------
Write-Host "`n🎨 [2/2] 正在构建并部署前端 Pages..." -ForegroundColor Yellow
Set-Location "frontend"

# 构建
Write-Host "   - 正在构建..." -ForegroundColor Gray
cmd /c "npm run build"
if ($LASTEXITCODE -ne 0) { 
    Write-Error "❌ 前端构建失败"
    exit 1 
}

# 部署 (指定 --branch main 以确保是生产环境)
Write-Host "   - 正在上传到 Cloudflare..." -ForegroundColor Gray
cmd /c "wrangler pages deploy dist --project-name ai-image-generator-frontend --branch main"
if ($LASTEXITCODE -ne 0) { 
    Write-Error "❌ 前端部署失败"
    exit 1 
}

Set-Location ".."

Write-Host "`n✅ All services deployed successfully to Cloudflare!" -ForegroundColor Green
