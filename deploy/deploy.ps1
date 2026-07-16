# 日序 — 一键部署脚本
# 用法: .\deploy.ps1

param([switch]$SkipUpload)

$server = "dayorder@39.104.75.202"
$projectRoot = "e:\OneDrive\hub\Individual Management System"

Write-Host "=== 日序云端部署 ===" -ForegroundColor Cyan

# 1. 打包
Write-Host "[1/4] 打包项目文件..." -ForegroundColor Yellow
Set-Location $projectRoot
tar -czf deploy/deploy.tar.gz backend/ frontend/ requirements.txt 2>$null
Write-Host "  打包完成: deploy/deploy.tar.gz"

if (-not $SkipUpload) {
    # 2. 上传
    Write-Host "[2/4] 上传到云端..." -ForegroundColor Yellow
    scp deploy/deploy.tar.gz ${server}:/home/dayorder/
    Write-Host "  上传完成"
}

# 3. 远程部署
Write-Host "[3/4] 云端部署中..." -ForegroundColor Yellow
ssh $server @"
cd /home/dayorder
tar -xzf deploy.tar.gz
cp -r backend/* app/backend/ 2>/dev/null
cp -r frontend/* app/frontend/ 2>/dev/null
cd app/backend
source ../venv/bin/activate
pip install -r /home/dayorder/requirements.txt -q 2>/dev/null
alembic upgrade head
sudo systemctl restart dayorder
echo 'deployed'
"@

# 4. 验证
Write-Host "[4/4] 验证部署..." -ForegroundColor Yellow
Start-Sleep 3
try {
    $r = Invoke-WebRequest -Uri "http://39.104.75.202/api/health" -TimeoutSec 10 -UseBasicParsing
    Write-Host "  状态: $($r.StatusCode) $($r.Content)" -ForegroundColor Green
} catch {
    Write-Host "  健康检查失败: $_" -ForegroundColor Red
}

# 清理
Remove-Item deploy/deploy.tar.gz -Force -ErrorAction SilentlyContinue
Write-Host "=== 完成 ===" -ForegroundColor Cyan
