"""部署 API — 接收代码包并自动部署"""
import os
import subprocess
import tarfile
import tempfile
from pathlib import Path

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/deploy", tags=["deploy"])

DEPLOY_KEY = os.environ.get("DEPLOY_KEY", "dayorder-deploy")
APP_DIR = Path("/home/dayorder/app")
VENV_PYTHON = "/home/dayorder/venv/bin/python"


@router.post("/upload")
async def upload_package(file: UploadFile = File(...)):
    """接收部署包"""
    if not file.filename or not file.filename.endswith(".tar.gz"):
        return JSONResponse({"error": "需要 .tar.gz 文件"}, status_code=400)

    # 保存到临时目录
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".tar.gz")
    try:
        content = await file.read()
        tmp.write(content)
        tmp.close()

        # 解压
        with tarfile.open(tmp.name, "r:gz") as tar:
            tar.extractall(path="/home/dayorder")

        return {"status": "ok", "size": len(content)}
    finally:
        os.unlink(tmp.name)


@router.post("/run")
async def run_deploy():
    """执行部署：复制文件 + 迁移 + 重启"""
    try:
        # 复制文件
        subprocess.run(["cp", "-r", "/home/dayorder/backend/", str(APP_DIR / "backend/")], check=False)
        subprocess.run(["cp", "-r", "/home/dayorder/frontend/", str(APP_DIR / "frontend/")], check=False)

        # 数据库迁移
        result = subprocess.run(
            [VENV_PYTHON, "-m", "alembic", "upgrade", "head"],
            cwd=str(APP_DIR / "backend"),
            capture_output=True, text=True, timeout=30
        )

        # 重启服务
        subprocess.run(["sudo", "systemctl", "restart", "dayorder"], check=False, timeout=10)

        return {
            "status": "ok",
            "migration": result.stdout.strip() or result.stderr.strip() or "no changes"
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
