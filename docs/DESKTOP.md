# 日序桌面端方案

## 目标

桌面端不改现有 FastAPI API、SQLite 数据结构或静态前端。Electron 只负责原生窗口、工作区选择、后端进程生命周期、日志和 Windows 安装包。

## 开发运行

```powershell
npm install
npm run desktop:dev
```

如果 PowerShell 拦截 `npm.ps1`，使用：

```powershell
npm.cmd install
npm.cmd run desktop:dev
```

开发模式会使用 `.venv\Scripts\python.exe` 启动 `backend/app/main.py`，并通过 `WORKSPACE_DIR` 指向选中的工作区。

## Windows 安装包

先安装 Python 打包依赖：

```powershell
.\.venv\Scripts\python.exe -m pip install pyinstaller
```

再构建：

```powershell
npm.cmd run dist:win
```

如果 GitHub 下载 Electron runtime 失败，使用镜像源：

```powershell
npm.cmd run dist:win:mirror
```

安装器会创建开始菜单和桌面快捷方式，应用图标使用仓库根目录的 `日序logo.ico`。

## 数据与同步

桌面端会直接启动本地后端并进入应用登录页。工作区先于账号存在，账号只用于解锁当前工作区里的本地数据库。

登录页提供两个工作区入口：

- 打开已有：选择包含 `dayorder.db` 或 `config.json` 的工作区，然后输入该工作区里的账号和密码
- 新建工作区：选择或创建一个文件夹，然后注册新账号并初始化数据库

默认工作区是：

```text
Documents\DayOrderWorkspace
```

工作区内仍是：

- `dayorder.db`
- `uploads/`
- `backups/`
- `exports/`
- `config.json`

把整个工作区放在 OneDrive 内，并设置为始终保留在本设备上，即可沿用现有同步方式。

## 注册

注册不需要邀请码。新用户必须先在登录页点击「新建工作区」，选择一个新的空文件夹，然后填写邮箱、密码和个人资料。注册完成后，账号和数据都会写入这个新工作区的 `dayorder.db`。

## 账号和密码

账号保存在当前工作区的 `dayorder.db` 里，不是全局账号。切换工作区后，需要使用那个工作区里的账号登录。

密码使用 PBKDF2 哈希保存，不使用明文。忘记密码时可以在本机对对应工作区执行重置命令：

```powershell
cd backend
$env:WORKSPACE_DIR="E:\OneDrive\hub\Individual Management System\DayOrderWorkspace"
..\.venv\Scripts\python.exe -m app.cli reset-password --email "zhang.haoyan@outlook.com" --password "new-password"
```

账户页只管理个人资料，不提供工作区地址修改。工作区切换只在登录/注册页进行。

## 桌面行为

关闭主窗口时会询问：

- 最小化到托盘：窗口隐藏，本地后端继续运行，可从托盘图标重新打开
- 退出日序：关闭窗口并停止本地后端进程

安装包卸载时会先停止 `dayorder-backend.exe`，避免残留正在运行的后端文件。

## 更新

当前工程已经预留 `electron-updater` 依赖位。真正启用自动更新时，需要在 `package.json` 的 `build.publish` 中配置 GitHub Releases 或 generic update server，然后在 `desktop/main.js` 中接入 `autoUpdater.checkForUpdatesAndNotify()`。
