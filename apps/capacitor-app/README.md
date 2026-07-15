# 日序 - 移动端 (Capacitor)

基于 Capacitor 的「日序」个人管理系统移动端，复用现有前端代码，支持离线使用。

## 架构

```
capacitor-app/
├── www/                          # 前端代码（从 ../frontend/ 复制）
│   ├── index.html                # 入口（已适配 Capacitor）
│   ├── app.js                    # 主应用
│   ├── styles.css                # Fluent Design 样式
│   └── js/
│       ├── capacitor-platform.js # 🆕 Capacitor 平台适配层
│       ├── offline-api.js        # 🆕 离线优先 API 层
│       ├── apiClient.js          # API 请求（已适配离线）
│       ├── state.js              # 全局状态
│       ├── utils.js              # 工具函数
│       ├── services/             # 业务服务层
│       └── views/                # 视图渲染层
├── android/                      # Android 原生项目
├── capacitor.config.ts           # Capacitor 配置
└── package.json
```

## 离线策略

```
┌─────────────────────────────────────────────┐
│              离线优先架构                      │
│                                               │
│  用户操作 ──→ offline-api.js                  │
│               │                               │
│         ┌─────┴─────┐                        │
│         │  在线？     │                        │
│         └─────┬─────┘                        │
│       ┌───────┴───────┐                      │
│       ▼               ▼                      │
│   远程 API        本地缓存                    │
│   (39.104.75.202)  (IndexedDB/SQLite)        │
│       │               │                      │
│       └───────┬───────┘                      │
│               ▼                              │
│         同步队列 → 网络恢复时自动推送          │
└─────────────────────────────────────────────┘
```

### 三层存储降级

1. **原生 SQLite**（Android/iOS 原生环境，通过 capacitor-sqlite 插件）
2. **IndexedDB**（Web 端 / 插件不可用时）
3. **localStorage**（最终降级）

### 离线能力

- ✅ 离线查看已缓存的数据（标签、微记、札记、任务等）
- ✅ 离线创建/编辑/删除（存入同步队列）
- ✅ 网络恢复后自动推送变更
- ✅ 自动拉取远程最新数据
- ✅ 登录凭证本地缓存（离线登录）

## 快速开始

### 前置条件

- Node.js 18+
- Android Studio（用于构建 Android APK）
- JDK 17+

### Web 端预览

```bash
cd capacitor-app
npm run serve
# 打开 http://localhost:3000
```

### Android 构建

```bash
cd capacitor-app
npm run build:android
# 在 Android Studio 中点击 Build → Build Bundle(s) / APK(s)
```

### 同步前端更新

当前端代码有更新时：

```bash
# 从 frontend/ 复制最新代码
Copy-Item -Path ..\frontend\* -Destination www\ -Recurse -Force

# 重新同步到 Android
npx cap sync
```

## 配置远程服务器

在登录页面，用户可以在「API 地址」输入框中配置远程服务器地址：

- 默认：`http://39.104.75.202`
- 本地开发：`http://127.0.0.1:8000`

配置会保存在 `localStorage` 的 `dayorder.apiBase` 中。

## 插件列表

| 插件 | 用途 |
|------|------|
| `@capacitor/filesystem` | 文件系统访问（附件、导出） |
| `@capacitor/local-notifications` | 本地通知（番茄钟提醒） |
| `capacitor-sqlite` | 本地 SQLite 数据库（离线存储） |

## 与原项目的差异

| 项目 | 原前端 | Capacitor 版 |
|------|--------|-------------|
| 加载方式 | `<script>` 标签 | 同，增加 2 个适配脚本 |
| API 请求 | 同源 `/api` | 远程 `http://39.104.75.202/api` |
| 离线支持 | 仅同步队列 | 完整离线读写 + 自动同步 |
| 后端 | 本地 Python 进程 | 远程云服务器 |
| 存储 | 仅 localStorage | SQLite → IndexedDB → localStorage |
