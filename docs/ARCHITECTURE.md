# 日序 (DayOrder) — 工程架构文档

> 一个基于 FastAPI + 原生 JavaScript 的个人管理系统，涵盖日程、日记、任务、倒数日等功能。

---

## 1. 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **后端框架** | FastAPI | 0.121.2 |
| **ASGI 服务器** | Uvicorn | 0.38.0 |
| **ORM** | SQLAlchemy | 2.0.44 |
| **数据库迁移** | Alembic | 1.17.2 |
| **配置管理** | pydantic-settings | 2.12.0 |
| **八字计算** | lunar-python | 1.4.8 |
| **数据库** | SQLite | — |
| **前端** | 原生 HTML/CSS/JS（无框架） | — |
| **设计系统** | Microsoft Fluent Design System | — |

---

## 2. 目录结构

```
Individual Management System/
├── requirements.txt                  # Python 依赖
├── ARCHITECTURE.md                   # 本文档
│
├── backend/                          # 后端服务
│   ├── alembic.ini                   # Alembic 配置
│   ├── alembic/
│   │   ├── env.py                    # 迁移环境配置
│   │   ├── script.py.mako            # 迁移脚本模板
│   │   └── versions/                 # 迁移版本文件 (8个)
│   │       ├── 20260515_0001_initial_auth_schema.py
│   │       ├── 20260515_0002_content_schema.py
│   │       ├── 20260515_0003_reminder_schema.py
│   │       ├── 20260516_0004_daily_task_time_period.py
│   │       ├── 20260516_0005_range_task_board.py
│   │       ├── 20260516_0006_avatar_signature.py
│   │       ├── 20260516_0007_milestone_background.py
│   │       └── 20260516_0008_auth_session_lookup_hash.py
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI 应用入口
│   │   ├── cli.py                    # 命令行工具
│   │   ├── api/                      # API 路由层
│   │   │   ├── __init__.py
│   │   │   ├── auth.py               # 认证相关接口
│   │   │   ├── users.py              # 用户相关接口
│   │   │   ├── invitations.py        # 邀请码管理接口
│   │   │   ├── tags.py               # 标签接口
│   │   │   ├── records.py            # 记录接口
│   │   │   ├── journals.py           # 日记接口
│   │   │   ├── reminders.py          # 提醒/任务接口
│   │   │   ├── calendar.py           # 日历视图接口
│   │   │   └── deps.py               # 依赖注入（认证中间件）
│   │   ├── models/                   # 数据模型层 (SQLAlchemy ORM)
│   │   │   ├── __init__.py
│   │   │   ├── auth.py               # 用户/认证相关模型
│   │   │   └── content.py            # 内容相关模型
│   │   ├── schemas/                  # Pydantic 数据校验层
│   │   │   ├── __init__.py
│   │   │   ├── auth.py               # 认证相关 Schema
│   │   │   └── content.py            # 内容相关 Schema
│   │   ├── services/                 # 业务逻辑层
│   │   │   ├── __init__.py
│   │   │   ├── auth.py               # 认证服务
│   │   │   ├── users.py              # 用户服务
│   │   │   ├── invitations.py        # 邀请码服务
│   │   │   ├── content.py            # 内容服务（标签/记录/日记/任务/倒数日）
│   │   │   └── bazi.py               # 八字计算服务
│   │   └── core/                     # 核心基础设施
│   │       ├── __init__.py
│   │       ├── config.py             # 应用配置
│   │       ├── database.py           # 数据库连接 & 初始化
│   │       ├── workspace.py          # 工作区 / uploads / backups
│   │       └── security.py           # 安全工具（密码哈希/Token）
│
├── frontend/                         # 前端（SPA）
│   ├── index.html                    # 入口 HTML
│   ├── app.js                        # 应用逻辑（单文件）
│   └── styles.css                    # 样式表（Fluent Design）
│
└── DayOrderWorkspace/                # OneDrive 同步工作区（默认）
    ├── dayorder.db                   # SQLite 数据库文件
    ├── config.json                   # 工作区配置
    ├── uploads/                      # 用户上传文件
    │   ├── avatars/
    │   ├── records/
    │   ├── journals/
    │   └── milestones/
    ├── backups/                      # 自动数据库备份
    └── exports/                      # 手动导出文件
```

---

## 3. 架构分层

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (SPA)                       │
│              index.html + app.js + styles.css            │
│              原生 JS，无框架，Fluent Design               │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP REST API (/api/*)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   API Layer (FastAPI)                    │
│  auth.py  users.py  invitations.py  tags.py             │
│  records.py  journals.py  reminders.py  calendar.py     │
│  deps.py (认证依赖注入: get_current_user / require_admin) │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                 Service Layer (业务逻辑)                  │
│  auth.py  users.py  invitations.py  content.py  bazi.py │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Model Layer (SQLAlchemy ORM)                │
│              auth.py (6 models)                          │
│              content.py (10 models)                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Core Infrastructure                         │
│  config.py (Settings)  database.py (Session)            │
│  security.py (PBKDF2 / Token)                           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              SQLite (DayOrderWorkspace/dayorder.db)      │
│              文件存储: DayOrderWorkspace/uploads/        │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 数据库模型 (ER 概要)

### 4.1 认证域 (`app/models/auth.py`)

| 模型 | 表名 | 说明 |
|------|------|------|
| `User` | `users` | 用户账户（邮箱、密码哈希、角色、状态） |
| `UserProfile` | `user_profiles` | 用户档案（昵称、性别、生日、八字、头像、签名） |
| `AuthSession` | `auth_sessions` | 登录会话（Token 哈希、过期时间） |
| `InvitationCode` | `invitation_codes` | 邀请码（哈希、邮箱绑定、使用次数） |
| `InvitationUse` | `invitation_uses` | 邀请码使用记录 |

### 4.2 内容域 (`app/models/content.py`)

| 模型 | 表名 | 说明 |
|------|------|------|
| `Tag` | `tags` | 标签（名称、颜色、排序、归档） |
| `TagLink` | `tag_links` | 标签关联（多态关联到各种内容） |
| `RecordType` | `record_types` | 记录类型（名称、图标、颜色、自定义 Schema） |
| `Record` | `records` | 记录（日期、类型、JSON 数据、备注） |
| `JournalEntry` | `journal_entries` | 日记（日期、标题、Markdown 内容、摘要） |
| `JournalEntryVersion` | `journal_entry_versions` | 日记版本历史 |
| `DailyTaskTemplate` | `daily_task_templates` | 每日任务模板（标题、时段、提醒时间） |
| `DailyTaskStatus` | `daily_task_status` | 每日任务完成状态 |
| `RangeTaskCategory` | `range_task_categories` | 近期任务分类 |
| `RangeReminder` | `range_reminders` | 近期任务/区间提醒（起止日期、步骤、状态） |
| `MilestoneDay` | `milestone_days` | 倒数日/纪念日（日期类型、倒计时、背景图） |

### 4.3 模型关系图

```
User ──1:1── UserProfile
User ──1:N── AuthSession
User ──1:N── InvitationCode (created_by)
User ──1:N── InvitationUse
User ──1:N── Tag / TagLink / RecordType / Record
User ──1:N── JournalEntry ──1:N── JournalEntryVersion
User ──1:N── DailyTaskTemplate ──1:N── DailyTaskStatus
User ──1:N── RangeTaskCategory ──1:N── RangeReminder
User ──1:N── MilestoneDay

Tag ──1:N── TagLink (多态: record / journal_entry / daily_task_template / range_reminder / milestone_day)
```

---

## 5. API 端点一览

### 5.1 认证 (`/api/auth`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/register-with-invite` | 邀请码注册 | 否 |
| POST | `/auth/login` | 邮箱密码登录 | 否 |
| POST | `/auth/logout` | 登出（撤销 Token） | 是 |

### 5.2 用户 (`/api/users`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/users/me/profile` | 获取个人档案 | 是 |
| PATCH | `/users/me/profile` | 更新个人档案 | 是 |
| POST | `/users/me/avatar` | 上传头像 | 是 |

### 5.3 管理员 (`/api/admin/invitations`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/admin/invitations` | 列出邀请码 | 管理员 |
| POST | `/admin/invitations` | 创建邀请码 | 管理员 |
| DELETE | `/admin/invitations/{id}` | 禁用邀请码 | 管理员 |

### 5.4 标签 (`/api/tags`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/tags` | 列出标签 | 是 |
| POST | `/tags` | 创建标签 | 是 |
| PATCH | `/tags/{id}` | 更新标签 | 是 |
| DELETE | `/tags/{id}` | 删除标签 | 是 |
| POST | `/tags/{id}/links` | 关联标签到内容 | 是 |
| DELETE | `/tags/{id}/links` | 取消标签关联 | 是 |

### 5.5 记录 (`/api`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/record-types` | 列出记录类型 | 是 |
| POST | `/record-types` | 创建记录类型 | 是 |
| PATCH | `/record-types/{id}` | 更新记录类型 | 是 |
| DELETE | `/record-types/{id}` | 删除记录类型 | 是 |
| GET | `/records` | 列出记录（支持日期/标签筛选） | 是 |
| POST | `/records` | 创建记录 | 是 |
| PATCH | `/records/{id}` | 更新记录 | 是 |
| DELETE | `/records/{id}` | 删除记录 | 是 |

### 5.6 日记 (`/api/journals`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/journals` | 列出日记（支持日期/标签/关键词筛选） | 是 |
| POST | `/journals` | 创建日记 | 是 |
| GET | `/journals/{id}` | 获取日记详情 | 是 |
| PATCH | `/journals/{id}` | 更新日记（自动版本管理） | 是 |
| DELETE | `/journals/{id}` | 删除日记 | 是 |
| GET | `/journals/{id}/versions` | 列出日记版本历史 | 是 |
| GET | `/journals/{id}/versions/{version_no}` | 获取特定版本 | 是 |

### 5.7 提醒/任务 (`/api`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/daily-task-templates` | 列出每日任务模板 | 是 |
| POST | `/daily-task-templates` | 创建每日任务模板 | 是 |
| PATCH | `/daily-task-templates/{id}` | 更新每日任务模板 | 是 |
| DELETE | `/daily-task-templates/{id}` | 删除每日任务模板 | 是 |
| GET | `/daily-tasks` | 获取指定日期的每日任务及状态 | 是 |
| PATCH | `/daily-tasks/{id}/status` | 更新每日任务完成状态 | 是 |
| GET | `/range-categories` | 列出近期任务分类 | 是 |
| POST | `/range-categories` | 创建近期任务分类 | 是 |
| PATCH | `/range-categories/{id}` | 更新近期任务分类 | 是 |
| DELETE | `/range-categories/{id}` | 删除近期任务分类 | 是 |
| GET | `/range-reminders` | 列出近期任务 | 是 |
| POST | `/range-reminders` | 创建近期任务 | 是 |
| PATCH | `/range-reminders/{id}` | 更新近期任务 | 是 |
| DELETE | `/range-reminders/{id}` | 删除近期任务 | 是 |
| GET | `/milestone-days` | 列出倒数日 | 是 |
| POST | `/milestone-days` | 创建倒数日 | 是 |
| PATCH | `/milestone-days/{id}` | 更新倒数日 | 是 |
| DELETE | `/milestone-days/{id}` | 删除倒数日 | 是 |
| POST | `/milestone-days/{id}/background` | 上传倒数日背景图 | 是 |

### 5.8 日历 (`/api/calendar`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/calendar/month` | 获取月视图数据（含农历、节日、每日摘要） | 是 |
| GET | `/calendar/day` | 获取日视图详情（含所有内容汇总） | 是 |

### 5.9 健康检查

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/health` | 服务健康检查 | 否 |

---

## 6. 安全机制

### 6.1 密码存储
- 使用 **PBKDF2-SHA256**，21 万次迭代
- 随机盐值（16 字节 hex）
- 存储格式：`pbkdf2_sha256${salt}${digest}`

### 6.2 会话管理
- Token 使用 `secrets.token_urlsafe(32)` 生成（43 字符）
- 数据库存储 Token 的 **PBKDF2 哈希**（不可逆）
- 额外存储 **SHA256 查找哈希** 用于快速索引
- 会话默认 **30 天**过期
- 支持 Token 撤销（logout）

### 6.3 认证流程
```
请求 → Header: Authorization: Bearer <token>
     → deps.py: _extract_bearer_token()
     → auth.py: get_user_from_token()
        → 先用 SHA256 查找哈希快速匹配
        → 未命中则遍历旧会话用 PBKDF2 验证并回填查找哈希
     → 返回 User 或 401
```

---

## 7. 前端架构

### 7.1 技术特点
- **纯原生 JavaScript**，无任何框架依赖
- **SPA 单页应用**，通过 `state.view` 切换视图
- **Microsoft Fluent Design System** 设计语言
- 自定义日期时间选择器（无第三方组件）

### 7.2 状态管理
全局 `state` 对象管理所有状态：
- `token` — 认证 Token（localStorage 持久化）
- `user` — 当前用户信息
- `view` — 当前视图（today / calendar / records / journals / nearTasks / dailyTasks / countdowns）
- `calendarYear/Month` — 日历年月
- `tags / recordTypes / records / journals` — 各模块数据缓存
- `edit.*` — 各模块编辑状态
- `filters` — 筛选条件

### 7.3 视图（导航菜单）
| 视图 | 中文名 | 图标 |
|------|--------|------|
| `today` | 今日 | home |
| `calendar` | 日历 | calendar |
| `records` | 微记 | check |
| `journals` | 札记 | note |
| `nearTasks` | 近期任务 | bell |
| `dailyTasks` | 每日任务 | check |
| `countdowns` | 倒数日 | calendar |

### 7.4 API 通信
- 统一 `request(path, options)` 函数封装 fetch
- 自动附加 `Authorization: Bearer` 头
- 统一错误处理（解析 `detail` 字段）

---

## 8. CLI 命令行工具

`backend/app/cli.py` 提供命令行管理功能：

```bash
# 创建管理员账号
python -m app.cli create-admin --email admin@example.com --password xxx

# 创建邀请码
python -m app.cli create-invite --role user --max-uses 5 --expires-at 2026-12-31
```

---

## 9. 配置项

通过 `backend/app/core/config.py` 管理，支持 `.env` 文件覆盖：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `app_name` | `DayOrder` | 应用名称 |
| `debug` | `true` | 调试模式 |
| `workspace_dir` | `DayOrderWorkspace` | OneDrive 文件级同步工作区 |
| `database_url` | 自动指向工作区 `dayorder.db` | 数据库连接；设置后会覆盖工作区数据库路径 |
| `session_expire_days` | `30` | 会话过期天数 |

---

## 10. 数据存储总结

| 存储类型 | 位置 | 内容 |
|----------|------|------|
| **SQLite 数据库** | `DayOrderWorkspace/dayorder.db` | 所有结构化数据 |
| **文件系统** | `DayOrderWorkspace/uploads/avatars/` | 用户头像 |
| **文件系统** | `DayOrderWorkspace/uploads/records/` | 微记附件 |
| **文件系统** | `DayOrderWorkspace/uploads/journals/` | 日记附件 |
| **文件系统** | `DayOrderWorkspace/uploads/milestones/` | 倒数日背景图 |
| **文件系统** | `DayOrderWorkspace/backups/` | 自动数据库备份 |
| **localStorage** | 浏览器 | 认证 Token (`dayorder.token`) |

---

## 11. 启动方式

```bash
# 安装依赖
pip install -r requirements.txt

# 启动后端（自动初始化数据库）
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 访问前端
http://127.0.0.1:8000/
```

后端启动时通过 `lifespan` 事件自动调用 `init_db()`，完成：
1. 创建 `data/` 目录
2. 导入所有模型
3. `Base.metadata.create_all()` 建表
4. 执行 SQLite 兼容的增量迁移（`_ensure_local_schema`）
