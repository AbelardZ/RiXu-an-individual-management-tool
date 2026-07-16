# 云端更新操作指南

> 服务器：`39.104.75.202`  
> 用户：`root`  
> 密码：`Zhy20050112`  
> 项目路径：`/home/dayorder/app`

---

## 一、连接服务器

VS Code 中按 `F1` → 输入 `Remote-SSH: Connect to Host` → 输入 `root@39.104.75.202` → 输入密码

或者在终端：
```powershell
& "C:\Windows\System32\OpenSSH\ssh.exe" root@39.104.75.202
```

---

## 二、修复 PostgreSQL 连接（当前 502 问题）

```bash
# 1. 重启 PostgreSQL
systemctl restart postgresql

# 2. 等 2 秒
sleep 2

# 3. 重启 dayorder 服务
systemctl restart dayorder

# 4. 等 3 秒后验证
sleep 3
curl -s http://127.0.0.1:8000/api/health
```

如果 `curl` 返回 JSON 则成功。如果还是报 PostgreSQL 密码错误，检查配置：
```bash
cat /home/dayorder/app/backend/.env | grep DATABASE
```

---

## 三、以后每次更新代码

云端不是 git 仓库，需要用 SCP 上传修改的文件。

### 方法 A：从本地 SCP 上传（推荐）

```powershell
# 在本地 PowerShell 中执行，上传所有改动的后端文件
& "C:\Windows\System32\OpenSSH\scp.exe" `
  "e:\OneDrive\hub\Individual Management System\core\backend\app\api\*.py" `
  "e:\OneDrive\hub\Individual Management System\core\backend\app\schemas\*.py" `
  "e:\OneDrive\hub\Individual Management System\core\backend\app\services\*.py" `
  "e:\OneDrive\hub\Individual Management System\core\backend\app\models\*.py" `
  root@39.104.75.202:/home/dayorder/app/backend/app/
```

然后 SSH 上去重启：
```bash
systemctl restart dayorder
```

### 方法 B：在服务器上 git clone

一劳永逸的方式——把云端也改成 git 管理：

```bash
cd /home/dayorder
mv app app_backup
git clone https://github.com/AbelardZ/RiXu-an-individual-management-tool.git app_temp
cp -r app_temp/core/backend/* app_backup/backend/
cp -r app_temp/core/frontend/* app_backup/frontend/
rm -rf app_temp
mv app_backup app
```

之后每次更新只需：
```bash
cd /home/dayorder/app
git pull
systemctl restart dayorder
```

---

## 四、常用命令速查

| 操作 | 命令 |
|------|------|
| 查看服务状态 | `systemctl status dayorder` |
| 重启服务 | `systemctl restart dayorder` |
| 查看错误日志 | `tail -50 /home/dayorder/workspace/error.log` |
| 查看访问日志 | `tail -50 /home/dayorder/workspace/access.log` |
| 测试健康检查 | `curl -s http://127.0.0.1:8000/api/health` |
| 重启 PostgreSQL | `systemctl restart postgresql` |
| 查看磁盘空间 | `df -h` |
| 查看内存 | `free -h` |

---

## 五、本次已上传的文件

- `core/backend/app/api/tasks.py` → `/home/dayorder/app/backend/app/api/tasks.py`
- `core/backend/app/schemas/content.py` → `/home/dayorder/app/backend/app/api/content.py`（注意：云端路径可能不同，schemas 应该在 `app/schemas/` 下）

如果 schemas 路径不对，需要补传：
```powershell
& "C:\Windows\System32\OpenSSH\scp.exe" `
  "e:\OneDrive\hub\Individual Management System\core\backend\app\schemas\content.py" `
  root@39.104.75.202:/home/dayorder/app/backend/app/schemas/
```
