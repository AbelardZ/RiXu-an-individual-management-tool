"""日序 — Python 一键部署脚本（无需 SSH/SCL）"""
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import urllib.error
import json

SERVER = "http://39.104.75.202"
PROJECT = r"e:\OneDrive\hub\Individual Management System"
TAR_NAME = os.path.join(PROJECT, "deploy", "deploy.tar.gz")


def step(msg):
    print(f"\n>>> {msg}")


def main():
    # 1. 打包
    step("打包项目文件...")
    os.chdir(PROJECT)
    with tarfile.open(TAR_NAME, "w:gz") as tar:
        for folder in ["backend", "frontend"]:
            path = os.path.join(PROJECT, folder)
            if os.path.exists(path):
                tar.add(path, arcname=folder)
        req = os.path.join(PROJECT, "requirements.txt")
        if os.path.exists(req):
            tar.add(req, arcname="requirements.txt")
    size_mb = os.path.getsize(TAR_NAME) / 1024 / 1024
    print(f"  打包完成: {size_mb:.1f} MB")

    # 2. 上传（通过云端 API）
    step("上传到云端...")
    with open(TAR_NAME, "rb") as f:
        data = f.read()

    # 使用 multipart 上传
    boundary = "----DayOrderDeploy"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{TAR_NAME}"\r\n'
        f"Content-Type: application/gzip\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"{SERVER}/api/deploy/upload",
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        resp = urllib.request.urlopen(req, timeout=120)
        result = json.loads(resp.read())
        print(f"  上传成功: {result}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  上传失败 ({e.code}): {body}")
        # 如果端点不存在，说明云端代码太旧，用备用方案
        if e.code == 404:
            print("\n  云端没有部署端点，请先手动部署一次。")
            print(f"  打包文件在: {os.path.join(PROJECT, TAR_NAME)}")
            print("  请用 FTP/SFTP 工具上传此文件到服务器 /home/dayorder/")
            print("  然后 SSH 执行:")
            print("    cd /home/dayorder && tar -xzf deploy.tar.gz")
            print("    cp -r backend/* app/backend/ && cp -r frontend/* app/frontend/")
            print("    cd app/backend && source ../venv/bin/activate")
            print("    alembic upgrade head && sudo systemctl restart dayorder")
            return
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"  连接失败: {e}")
        sys.exit(1)

    # 3. 触发部署
    step("触发云端部署...")
    req2 = urllib.request.Request(
        f"{SERVER}/api/deploy/run",
        data=b"{}",
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        resp2 = urllib.request.urlopen(req2, timeout=30)
        print(f"  部署触发: {resp2.read().decode()}")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print("  云端无部署端点，文件已上传，请手动重启服务。")
        else:
            print(f"  触发失败: {e.code}")

    # 4. 验证
    step("验证...")
    import time
    time.sleep(3)
    try:
        resp3 = urllib.request.urlopen(f"{SERVER}/api/health", timeout=10)
        print(f"  状态: {resp3.status} {resp3.read().decode()}")
    except Exception as e:
        print(f"  验证失败: {e}")

    # 清理
    os.remove(TAR_NAME)
    print("\n=== 完成 ===")


if __name__ == "__main__":
    main()
