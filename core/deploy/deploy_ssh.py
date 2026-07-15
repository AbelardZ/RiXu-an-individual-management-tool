"""日序 — SSH 一键部署"""
import os
import sys
import tarfile
import paramiko

SERVER = "39.104.75.202"
USER = "dayorder"
PROJECT = r"e:\OneDrive\hub\Individual Management System"
TAR_NAME = os.path.join(PROJECT, "core", "deploy", "deploy.tar.gz")

# 打包
print(">>> 打包...")
os.chdir(PROJECT)
with tarfile.open(TAR_NAME, "w:gz") as tar:
    for folder in ["core/backend", "core/frontend"]:
        tar.add(os.path.join(PROJECT, folder), arcname=folder.split("/")[-1])
    req = os.path.join(PROJECT, "core", "requirements.txt")
    if os.path.exists(req):
        tar.add(req, arcname="requirements.txt")
print(f"  打包完成: {os.path.getsize(TAR_NAME) / 1024 / 1024:.1f} MB")

# SSH 连接
print(f"\n>>> 连接 {USER}@{SERVER}...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

# 尝试密钥认证，失败则用密码
try:
    ssh.connect(SERVER, username=USER, timeout=10)
except Exception:
    from getpass import getpass
    pw = getpass(f"  请输入 {USER}@{SERVER} 的密码: ")
    ssh.connect(SERVER, username=USER, password=pw, timeout=10)
print("  已连接")

# 上传
print("\n>>> 上传文件...")
sftp = ssh.open_sftp()
sftp.put(TAR_NAME, "/home/dayorder/deploy.tar.gz")
sftp.close()
print("  上传完成")

# 远程部署
print("\n>>> 云端部署...")
cmds = [
    "cd /home/dayorder",
    "tar -xzf deploy.tar.gz",
    "cp -r backend/* app/backend/ 2>/dev/null || true",
    "cp -r frontend/* app/frontend/ 2>/dev/null || true",
    "cd app/backend",
    "source ../venv/bin/activate",
    "pip install -r /home/dayorder/requirements.txt -q 2>/dev/null || true",
    "alembic upgrade head",
    "sudo systemctl restart dayorder",
    "echo 'OK'",
]
cmd = " && ".join(cmds)
stdin, stdout, stderr = ssh.exec_command(cmd)
out = stdout.read().decode()
err = stderr.read().decode()
if err:
    print(f"  stderr: {err[:500]}")
print(f"  {out.strip()[-200:]}")

ssh.close()

# 验证
import urllib.request, time
print("\n>>> 验证...")
time.sleep(3)
try:
    resp = urllib.request.urlopen(f"http://{SERVER}/api/health", timeout=10)
    print(f"  状态: {resp.status} {resp.read().decode()}")
except Exception as e:
    print(f"  验证失败: {e}")

os.remove(os.path.join(PROJECT, TAR_NAME))
print("\n=== 完成 ===")
