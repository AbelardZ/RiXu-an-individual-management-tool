# 日序 (DayOrder) — 云服务器部署指南

> 适用：Ubuntu 22.04 / 24.04 LTS  
> 耗时：约 20-30 分钟  
> 目标：部署日序云端服务器（用户认证、数据同步的唯一权威源）

---

## 架构说明

```
┌──────────────────────┐         ┌──────────────────────┐
│   本地客户端           │         │   云端服务器 (权威源)   │
│                      │  注册/登录│                      │
│   本地数据 = 备份缓存  │ ◄──────►│   PostgreSQL         │
│   默认 C:/DayOrderBackup│        │   邀请码管理          │
│                      │  同步   │   用户管理            │
│   离线时可查看本地缓存  │ ◄──────►│   数据同步            │
└──────────────────────┘         └──────────────────────┘
```

**核心原则**：
- 云端是**唯一权威数据源**，所有注册/登录必须经过云端
- 本地数据仅作为**备份缓存**，方便离线查看
- 邀请码在云端创建和管理
- 客户端 `.env` 中配置 `CLOUD_API_URL` 指向云端

---

## 目录

- [一、服务器选型](#一服务器选型)
- [二、前置准备](#二前置准备)
- [三、环境安装](#三环境安装)
- [四、PostgreSQL 配置](#四postgresql-配置)
- [五、部署项目代码](#五部署项目代码)
- [六、配置文件](#六配置文件)
- [七、Nginx 反向代理](#七nginx-反向代理)
- [八、Systemd 服务](#八systemd-服务)
- [九、数据库迁移](#九数据库迁移)
- [十、创建邀请码](#十创建邀请码)
- [十一、验证部署](#十一验证部署)
- [十二、客户端配置](#十二客户端配置)
- [十三、日常维护](#十三日常维护)
- [十四、安全清单](#十四安全清单)
- [十五、故障排查](#十五故障排查)

---

## 一、服务器选型

| 配置 | 最低 | 推荐 |
|------|------|------|
| CPU | 1 核 | 2 核 |
| 内存 | 1 GB | 2 GB |
| 硬盘 | 20 GB SSD | 40 GB SSD |
| 系统 | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| 带宽 | 1 Mbps | 5 Mbps |

国内推荐阿里云 ECS 或腾讯云 CVM 轻量应用服务器（月费约 ¥40-70），海外推荐 AWS Lightsail 或 Vultr（月费约 $5-6）。

---

## 二、前置准备

### 2.1 域名 & DNS

在域名服务商处添加 A 记录，将 `api.你的域名.com` 指向服务器公网 IP。

### 2.2 服务器初始设置

1. SSH 登录服务器
2. 创建非 root 用户（如 `dayorder`）并授予 sudo 权限
3. 后续操作均使用此用户

### 2.3 需要安装的软件包

- **Python 3.11** + venv + dev
- **PostgreSQL** + contrib
- **Nginx**
- **Certbot** + python3-certbot-nginx（Let's Encrypt SSL 证书）
- **Git**、**curl**、**ufw**（防火墙）

### 2.4 系统配置

- 时区设为 `Asia/Shanghai`
- 1G 内存服务器建议创建 2G swap 防止 OOM
- 防火墙只开放 22（SSH）、80（HTTP）、443（HTTPS）端口

---

## 三、Python 依赖

在虚拟环境中安装以下包：

| 包名 | 版本 | 用途 |
|------|------|------|
| fastapi | 0.121.2 | Web 框架 |
| uvicorn[standard] | 0.38.0 | ASGI 服务器 |
| sqlalchemy | 2.0.44 | ORM |
| alembic | 1.17.2 | 数据库迁移 |
| pydantic-settings | 2.12.0 | 配置管理 |
| lunar-python | 1.4.8 | 农历/八字 |
| python-multipart | 0.0.20 | 文件上传 |
| tzdata | 2025.2 | 时区数据 |
| psycopg2-binary | 2.9.10 | PostgreSQL 驱动 |
| gunicorn | 23.0.0 | 生产级 WSGI 服务器 |

---

## 四、PostgreSQL 配置

### 4.1 创建数据库

- 创建用户 `dayorder`（设置强密码）
- 创建数据库 `dayorder`，owner 设为 `dayorder`
- 授权 schema public 给 `dayorder`

### 4.2 性能优化（1G 内存参考值）

| 参数 | 建议值 |
|------|--------|
| shared_buffers | 64MB |
| effective_cache_size | 256MB |
| maintenance_work_mem | 16MB |
| work_mem | 4MB |
| max_connections | 30 |
| wal_buffers | 4MB |

配置文件路径：`/etc/postgresql/*/main/conf.d/dayorder.conf`，修改后重启 PostgreSQL。

---

## 五、部署项目代码

### 5.1 上传方式

- **scp**：本地打包 `backend/` + `frontend/` + `requirements.txt`，上传到服务器
- **git**：服务器上 clone 仓库

### 5.2 目录结构

```
/home/dayorder/
├── venv/                     # Python 虚拟环境
├── app/
│   ├── backend/              # FastAPI 后端代码
│   └── frontend/             # 前端静态文件
├── workspace/                # 数据目录
│   ├── backups/              # 数据库备份
│   ├── exports/              # 导出文件
│   └── uploads/              # 用户上传
│       ├── avatars/
│       ├── records/
│       ├── journals/
│       └── milestones/
├── .env                      # 环境变量配置
└── run.sh                    # 启动脚本
```

---

## 六、配置文件

### 6.1 环境变量 `.env`

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `APP_NAME` | 应用名称 | `DayOrder` |
| `DEBUG` | 调试模式（生产环境必须为 false） | `false` |
| `WORKSPACE_DIR` | 数据目录 | `/home/dayorder/workspace` |
| `SESSION_EXPIRE_DAYS` | 会话过期天数 | `30` |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://dayorder:密码@localhost:5432/dayorder` |
| `CLOUD_API_URL` | 云端 API 地址 | `https://api.你的域名.com` |
| `CLOUD_SYNC_ENABLED` | 启用云端同步 | `true` |
| `SECRET_KEY` | JWT 签名密钥 | 用 `python3 -c "import secrets; print(secrets.token_hex(32))"` 生成 |
| `CORS_ORIGINS` | 允许的跨域来源（可选） | `*` 或具体域名 |
| `HEALTH_CHECK_URL` | 网络检测地址（可选） | 海外服务器建议设为 `https://www.google.com` |

### 6.2 启动脚本 `run.sh`

用 **gunicorn + uvicorn worker** 运行，关键参数：

- `-w 4`：4 个 worker 进程（1G 内存推荐 2-4）
- `--bind 127.0.0.1:8000`：只监听本地，由 Nginx 代理
- `--timeout 120`：请求超时 120 秒
- 设置环境变量 `DAYORDER_FRONTEND_DIR` 指向前端目录
- 设置环境变量 `DAYORDER_DATA_DIR` 指向工作区目录

---

## 七、Nginx 反向代理

### 7.1 配置要点

- HTTP（80）永久重定向到 HTTPS（443）
- 登录接口 `/api/auth/login` 限流：5 次/分钟
- 通用 API `/api/` 限流：60 次/分钟
- `client_max_body_size` 设为 50m（支持大文件上传）
- 静态文件（JS/CSS/图片）设置 7 天浏览器缓存
- 添加安全头：`X-Content-Type-Options`、`X-Frame-Options`、`Strict-Transport-Security`

### 7.2 SSL 证书

用 Certbot 申请 Let's Encrypt 免费证书，证书会自动续期。

---

## 八、Systemd 服务

创建 `/etc/systemd/system/dayorder.service`，关键配置：

- **User/Group**：`dayorder`
- **EnvironmentFile**：`/home/dayorder/.env`
- **ExecStart**：`/home/dayorder/run.sh`
- **Restart**：`always`，间隔 5 秒
- **内存限制**：`MemoryMax=400M`，`MemoryHigh=350M`（1G 总内存下）

启动命令：`systemctl daemon-reload` → `systemctl enable dayorder` → `systemctl start dayorder`

---

## 九、数据库迁移

在 `backend/` 目录下执行 `alembic upgrade head`，确保数据库 schema 与代码同步。

---

## 十、创建邀请码

部署完成后，在**云端服务器**上创建邀请码：

```bash
cd /home/dayorder/app/backend
source /home/dayorder/venv/bin/activate

# 创建邀请码（自动生成随机码）
python -m app.cli create-invite

# 创建可多次使用的邀请码
python -m app.cli create-invite --max-uses 10 --expires-days 90

# 创建绑定邮箱的邀请码
python -m app.cli create-invite --email user@example.com

# 查看所有邀请码
python -m app.cli list-invites

# 禁用某个邀请码
python -m app.cli disable-invite --id 1
```

> ⚠️ 邀请码仅在创建时显示原始码一次，请妥善保管。

---

## 十一、验证部署

1. **健康检查**：`GET /api/health` 应返回 `{"status":"ok","app":"DayOrder",...}`
2. **注册测试**：在浏览器打开 `https://api.你的域名.com`，使用邀请码注册
3. **登录测试**：注册成功后登录，应进入引导页

---

## 十二、客户端配置

在客户端（用户电脑）的 `backend/.env` 中设置：

```env
CLOUD_API_URL=https://api.你的域名.com
CLOUD_SYNC_ENABLED=true
```

### 客户端行为

- **注册/登录**：必须连接云端，不可绕过
- **本地数据**：默认存储在 `C:/DayOrderBackup`，仅作备份缓存
- **离线使用**：之前登录过的用户可离线查看本地缓存数据
- **同步**：每 30 秒自动与云端同步

---

## 十三、日常维护

| 操作 | 命令/方式 |
|------|-----------|
| 查看应用日志 | `journalctl -u dayorder -f` |
| 查看 Nginx 日志 | `/var/log/nginx/dayorder-access.log` |
| 数据库备份 | `pg_dump -U dayorder dayorder \| gzip > backup.sql.gz` |
| 自动备份 | crontab 定时任务（建议每天凌晨 3 点） |
| 更新代码 | git pull → pip install → alembic upgrade → systemctl restart |
| SSL 续期 | Certbot 自动续期，可用 `certbot renew --dry-run` 验证 |
| 管理邀请码 | `python -m app.cli list-invites` / `create-invite` / `disable-invite` |

---

## 十四、安全清单

部署完成后逐项检查：

- [ ] PostgreSQL 密码已修改（非默认）
- [ ] `SECRET_KEY` 已用随机字符串替换
- [ ] `.env` 中 `DEBUG=false`
- [ ] PostgreSQL 关闭远程访问（`pg_hba.conf` 仅 local）
- [ ] 防火墙已启用（仅 22/80/443 开放）
- [ ] SSH 禁用 root 登录
- [ ] SSL 证书已配置（HTTPS 可访问）
- [ ] 自动备份已配置
- [ ] `.env` 文件权限设为 600
- [ ] 已创建初始邀请码

---

## 十五、故障排查

| 现象 | 可能原因 | 检查方式 |
|------|----------|----------|
| 502 Bad Gateway | 后端未启动 | `systemctl status dayorder` |
| 数据库连接失败 | 密码错误或 pg_hba 配置 | `psql -U dayorder -h localhost -d dayorder` |
| SSL 证书错误 | 证书过期或域名不匹配 | `certbot certificates` |
| 端口被占用 | 旧进程未退出 | `lsof -i :8000` |
| 客户端注册失败 | 邀请码无效或云端不可达 | 检查云端服务器状态和邀请码 |
| 客户端登录失败 | 云端不可达且无离线凭据 | 检查网络和 `CLOUD_API_URL` |
| 内存不足 | 负载过高 | `free -h`，考虑增加 swap 或升级 |
| 磁盘满 | 备份/日志堆积 | `df -h`，清理旧文件 |
