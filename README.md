# 日序 (DayOrder)

> 一个基于 FastAPI + 原生 JavaScript 的个人管理系统，涵盖日程、日记、任务、倒数日、番茄钟、天气等功能。

---

## 项目结构

```
日序/
├── core/                        ← 内核（后端 + 前端 + 部署）
│   ├── backend/                 ← FastAPI 后端 (SQLAlchemy + SQLite)
│   ├── frontend/                ← 原生前端 (HTML/CSS/JS, Fluent Design)
│   ├── deploy/                  ← 云端部署脚本 & Nginx 配置
│   └── requirements.txt         ← Python 依赖
│
├── apps/                        ← 应用端
│   ├── electron/                ← 桌面端 (Electron + PyInstaller)
│   │   ├── src/                 ← Electron 源码
│   │   ├── build/               ← NSIS 安装脚本
│   │   └── dist/                ← 打包输出
│   └── capacitor-app/           ← 移动端 (Capacitor)
│
├── docs/                        ← 文档
│   ├── ARCHITECTURE.md          ← 工程架构
│   ├── CLOUD_DEPLOY.md          ← 云部署指南
│   └── DESKTOP.md               ← 桌面端方案
│
├── assets/                      ← 图标资源
├── DayOrderWorkspace/           ← 运行时数据 (本地数据库/备份/上传)
└── package.json                 ← Electron 构建配置
```

---

## 快速开始

### 环境要求

- Python 3.11+
- Node.js 18+ (仅桌面端/移动端构建)

### 1. 克隆 & 安装依赖

```powershell
git clone <repo-url>
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

浏览器打开 `http://127.0.0.1:8000` 即可使用。

### 3. 创建管理员

```powershell
cd core/backend
python -m app.cli create-admin --email admin@example.com --password "your-password"
```

---

## 桌面端

```powershell
npm install
npm run desktop:dev          # 开发模式
npm run dist:win             # 打包 Windows 安装包
```

详见 [docs/DESKTOP.md](docs/DESKTOP.md)

---

## 移动端

```powershell
cd apps/capacitor-app
npm install
npx cap sync
npx cap open android         # Android Studio
```

---

## 云端部署

详见 [docs/CLOUD_DEPLOY.md](docs/CLOUD_DEPLOY.md)

快速部署：

```powershell
.\core\deploy\deploy.ps1     # PowerShell
python core/deploy/deploy.py # Python
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | FastAPI |
| ORM | SQLAlchemy + Alembic |
| 数据库 | SQLite (本地) / PostgreSQL (云端) |
| 前端 | 原生 HTML/CSS/JS (Fluent Design) |
| 桌面端 | Electron + PyInstaller |
| 移动端 | Capacitor |
| 八字 | lunar-python |

---

## 功能模块

- 📅 **日历聚合** — 日程/日记/任务/倒数日统一视图
- 📝 **日记** — 支持版本历史
- ✅ **每日任务** — 模板生成 + 时间段
- 🔔 **范围提醒** — 时间段任务 + 看板视图
- 🎯 **倒数日** — 年度/一次性里程碑
- 🍅 **番茄钟** — 工作日志记录
- 🌤️ **天气** — 城市天气卡片
- 🏷️ **标签 & 记录** — 自定义记录类型
- 🔐 **用户认证** — 本地 + 云端同步
- 🎂 **八字命理** — 注册时自动计算

---

## License

MIT
