# 日序 (DayOrder)

> 一个全栈个人管理系统 — 日程、日记、任务、倒数日、番茄钟、天气、八字命理，一应俱全。

**FastAPI + 原生 JavaScript**，支持桌面端 (Electron)、移动端 (Capacitor) 和云端部署。

---

## 项目结构

```
日序/
├── core/                              ← 内核
│   ├── backend/                       ← FastAPI 后端
│   │   ├── app/
│   │   │   ├── api/                   ← API 路由 (auth, tasks, records, journals, reminders, calendar, sync…)
│   │   │   ├── models/                ← SQLAlchemy 数据模型
│   │   │   ├── schemas/               ← Pydantic 请求/响应模型
│   │   │   ├── services/              ← 业务逻辑 (bazi, sync_engine, storage, cloud_auth…)
│   │   │   └── core/                  ← 配置、数据库、安全、工作区
│   │   ├── alembic/                   ← 数据库迁移
│   │   └── dayorder_backend.py        ← PyInstaller 打包入口
│   ├── frontend/                      ← 原生前端 (HTML/CSS/JS, Fluent Design)
│   │   ├── js/views/                  ← 7 个视图组件
│   │   └── js/services/               ← 7 个服务模块
│   ├── deploy/                        ← 云端部署脚本 & Nginx 配置
│   └── requirements.txt               ← Python 依赖
│
├── apps/                              ← 应用端
│   ├── electron/                      ← 桌面端
│   │   ├── src/                       ← Electron 源码 (main.js, preload.js, setup)
│   │   ├── build/                     ← NSIS 安装脚本
│   │   └── dist/                      ← 打包输出 (.exe)
│   └── capacitor-app/                 ← 移动端 (Android + iOS)
│
├── docs/                              ← 文档
│   ├── ARCHITECTURE.md                ← 工程架构
│   ├── CLOUD_DEPLOY.md                ← 云部署指南
│   └── DESKTOP.md                     ← 桌面端方案
├── assets/                            ← 图标资源
├── DayOrderWorkspace/                 ← 运行时数据 (本地数据库/备份/上传)
└── package.json                       ← Electron 构建配置
```

---

## 功能模块

### 📅 日历聚合
月视图 + 日视图，统一展示微记、札记、每日任务、阶段事项、倒数日。支持按类型、标签、完成状态过滤，集成农历显示。

### 📝 微记 (Records)
自定义记录类型 — 名称、图标、颜色、自定义字段（文本/数字/布尔/日期/时间/下拉）。按日期范围、类型、标签灵活筛选。

### 📓 札记 (Journals)
Markdown 编辑器，每次保存自动创建版本快照，支持版本历史回溯。标签筛选、关键词搜索、字数统计。

### ✅ 每日任务
模板系统 — 创建可复用模板，支持时间段（全天/上午/下午/晚上）。按日期生成任务实例，进度条显示完成率，乐观更新即时响应。

### 🔔 阶段事项 (Range Reminders)
分类看板管理，支持日期范围，步骤追踪，每天自动显示。

### 🎯 倒数日 (Milestone Days)
年度重复日期（生日、纪念日）和一次性目标日期。支持公历/农历，倒计时显示，背景图片，周年计数。

### 🍅 番茄钟
倒计时/正计时双模式，预设 15/25/30/45/60 分钟。悬浮窗环形进度条，关联任务，工作日志记录，今日统计。

### 🌤️ 天气
多城市天气卡片，使用 wttr.in 免费 API。温度、湿度、风速、预报，渐变背景。

### 🎂 八字命理
注册时基于出生日期自动计算四柱八字 — 年/月/日/时柱天干地支、五行、纳音。支持重新计算。

### 🔄 云端同步
Push/Pull 双向同步，离线累积变更，在线批量推送。30 秒自动间隔，LWW 冲突策略。

### 🔐 用户认证
邀请码注册，JWT Token，离线登录，PBKDF2-SHA256 密码哈希（210,000 迭代）。

### 💾 备份导出
JSON 导出、SQLite 副本、完整数据包（ZIP：数据库 + 上传文件 + 配置）。

---

## 快速开始

### 环境要求

- **Python** 3.11+
- **Node.js** 18+（仅桌面端/移动端构建）

### 1. 克隆 & 安装

```powershell
git clone https://github.com/AbelardZ/RiXu-an-individual-management-tool.git
cd "Individual Management System"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r core/requirements.txt
```

### 2. 启动开发服务器

```powershell
cd core/backend
uvicorn app.main:app --reload
```

浏览器打开 **http://127.0.0.1:8000** 即可使用。

### 3. 创建管理员账号

```powershell
cd core/backend
python -m app.cli create-admin --email admin@example.com --password "your-password"
```

---

## 桌面端

```powershell
npm install                # 安装 Electron 依赖
npm run desktop:dev        # 开发模式
npm run dist:win           # 打包 Windows 安装包 (.exe)
npm run dist:win:mirror    # 使用国内镜像加速
```

桌面端特性：
- 系统托盘，最小化不退出
- 工作区选择器（新建/打开已有）
- 自动查找空闲端口启动后端
- 后端进程生命周期管理
- 单实例锁

详见 [docs/DESKTOP.md](docs/DESKTOP.md)

---

## 移动端

```powershell
cd apps/capacitor-app
npm install
npx cap sync
npx cap open android        # Android Studio
npx cap open ios            # Xcode
```

移动端特性：
- Capacitor SQLite 本地数据库
- 本地通知（番茄钟提醒）
- 文件系统访问

---

## 云端部署

支持一键部署到 Ubuntu 22.04/24.04 云服务器：

```powershell
.\core\deploy\deploy.ps1              # PowerShell
python core/deploy/deploy.py          # Python (HTTP)
python core/deploy/deploy_ssh.py      # Python (SSH)
```

云端使用 PostgreSQL 数据库，Nginx 反向代理，Systemd 服务管理。

详见 [docs/CLOUD_DEPLOY.md](docs/CLOUD_DEPLOY.md)

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端框架 | FastAPI 0.121 | 异步 Python Web 框架 |
| ASGI 服务器 | Uvicorn 0.38 | 高性能 ASGI 服务器 |
| ORM | SQLAlchemy 2.0 | 数据库 ORM |
| 数据库迁移 | Alembic 1.17 | 版本化数据库迁移 |
| 数据库 | SQLite / PostgreSQL | 本地开发 / 云端生产 |
| 配置管理 | pydantic-settings 2.12 | 类型安全配置 |
| 八字计算 | lunar-python 1.4 | 农历 + 八字命理 |
| 前端 | 原生 HTML/CSS/JS | 零框架依赖，Fluent Design |
| 桌面端 | Electron 31 + PyInstaller | Windows NSIS 安装包 |
| 移动端 | Capacitor 8 | Android + iOS |
| 天气 | wttr.in | 免费天气 API |

---

## API 概览

| 路由 | 说明 |
|------|------|
| `POST /api/auth/register` | 注册（邀请码） |
| `POST /api/auth/login` | 登录 |
| `GET/PATCH /api/users/me/profile` | 个人资料 |
| `POST /api/users/me/recalculate-bazi` | 重新计算八字 |
| `CRUD /api/tags` | 标签管理 |
| `CRUD /api/records` | 微记 |
| `CRUD /api/record-types` | 记录类型 |
| `CRUD /api/journals` | 札记 + 版本历史 |
| `CRUD /api/daily-task-templates` | 每日任务模板 |
| `GET/PATCH /api/daily-tasks` | 每日任务实例 |
| `CRUD /api/range-reminders` | 阶段事项 |
| `CRUD /api/milestone-days` | 倒数日 |
| `GET /api/calendar/month` | 月视图 |
| `GET /api/calendar/day/{date}` | 日视图 |
| `CRUD /api/tasks/timer` | 番茄钟计时 |
| `CRUD /api/tasks/work-log` | 工作日志 |
| `POST /api/sync/push` | 推送变更 |
| `POST /api/sync/pull` | 拉取变更 |
| `POST /api/backup/export/full` | 完整备份导出 |

---

## 配置

通过 `core/backend/.env` 配置：

```env
# 数据库 (不设则默认 SQLite)
DATABASE_URL=sqlite:///C:/DayOrderBackup/dayorder.db

# 工作区目录
WORKSPACE_DIR=C:/DayOrderBackup

# 云端同步
CLOUD_API_URL=https://api.dayorder.com
CLOUD_SYNC_ENABLED=false

# 安全
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:3000
```

---

## License

MIT
