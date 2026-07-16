const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");

let mainWindow;
let backendProcess;
let backendPort;
let isQuitting = false;
let tray;
let closePromptOpen = false;

const projectRoot = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");
const userDataDir = app.getPath("userData");
const configPath = path.join(userDataDir, "desktop-config.json");
const logDir = path.join(userDataDir, "logs");

function iconPath() {
  const candidate = path.join(projectRoot, "assets", "dayorder.ico");
  return fs.existsSync(candidate) ? candidate : undefined;
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ version: 1, ...config }, null, 2), "utf8");
}

function defaultWorkspacePath() {
  return path.join(app.getPath("documents"), "DayOrderWorkspace");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: "日序",
    icon: iconPath(),
    backgroundColor: "#f7f4ef",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!backendPort || !url.startsWith(`http://127.0.0.1:${backendPort}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  mainWindow.on("close", async (event) => {
    if (isQuitting || closePromptOpen) return;
    event.preventDefault();
    closePromptOpen = true;
    const result = await dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["最小化到托盘", "退出日序", "取消"],
      defaultId: 0,
      cancelId: 2,
      message: "要关闭日序吗？",
      detail: "最小化到托盘会保持本地后端运行，退出日序会关闭窗口并停止本地后端进程。",
    });
    closePromptOpen = false;
    if (result.response === 0) {
      mainWindow.hide();
    } else if (result.response === 1) {
      isQuitting = true;
      app.quit();
    }
  });
}

function loadSetup() {
  mainWindow.loadFile(path.join(__dirname, "setup.html"));
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray || !iconPath()) return;
  tray = new Tray(iconPath());
  tray.setToolTip("日序");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "打开日序", click: showMainWindow },
    { type: "separator" },
    { label: "打开当前工作区", click: () => shell.openPath(readConfig().workspacePath || defaultWorkspacePath()) },
    { label: "打开日志目录", click: () => shell.openPath(logDir) },
    { type: "separator" },
    {
      label: "退出日序",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));
  tray.on("click", showMainWindow);
}

function appendBackendLog(text) {
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(path.join(logDir, "backend.log"), text, "utf8");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("backend:log", text);
  }
}

function findPython() {
  const localPython = path.join(projectRoot, ".venv", "Scripts", "python.exe");
  if (fs.existsSync(localPython)) return localPython;
  return "python";
}

function findPackagedBackend() {
  const candidates = [
    path.join(projectRoot, "backend", "dayorder-backend.exe"),
    path.join(projectRoot, "backend", "dist", "dayorder-backend.exe"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function backendEnvironment(workspacePath) {
  return {
    ...process.env,
    WORKSPACE_DIR: workspacePath,
    DAYORDER_FRONTEND_DIR: path.join(projectRoot, "frontend"),
    PYTHONUTF8: "1",
    PYTHONIOENCODING: "utf-8",
  };
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function startBackend(port, workspacePath) {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }

  const packagedBackend = app.isPackaged ? findPackagedBackend() : null;
  if (app.isPackaged && !packagedBackend) {
    throw new Error("未找到打包后的 dayorder-backend.exe，请先运行 npm.cmd run build:backend 再制作安装包。");
  }
  const command = packagedBackend || findPython();
  const args = packagedBackend
    ? ["--host", "127.0.0.1", "--port", String(port)]
    : ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(port)];
  const cwd = packagedBackend ? path.dirname(packagedBackend) : path.join(projectRoot, "backend");

  backendProcess = spawn(command, args, {
    cwd,
    env: backendEnvironment(workspacePath),
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (chunk) => appendBackendLog(chunk.toString()));
  backendProcess.stderr.on("data", (chunk) => appendBackendLog(chunk.toString()));
  backendProcess.on("error", (error) => {
    appendBackendLog(`\n[desktop] failed to start backend: ${error.message}\n`);
  });
  backendProcess.on("exit", (code) => {
    appendBackendLog(`\n[desktop] backend exited with code ${code}\n`);
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox("日序后端已停止", "本地数据服务已退出。请重新打开日序，或查看桌面日志。");
    }
  });
}

function requestHealth(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: "/api/health", timeout: 1000 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode === 200) resolve(body);
        else reject(new Error(`health returned ${response.statusCode}`));
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error("health check timed out"));
    });
    request.on("error", reject);
  });
}

async function waitForBackend(port) {
  const deadline = Date.now() + 30000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await requestHealth(port);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError || new Error("backend did not become ready");
}

async function openWorkspace(workspacePath) {
  fs.mkdirSync(workspacePath, { recursive: true });
  writeConfig({ workspacePath });
  backendPort = await findFreePort();
  mainWindow.webContents.send("backend:status", "正在启动本地数据服务...");
  try {
    startBackend(backendPort, workspacePath);
    await waitForBackend(backendPort);
  } catch (error) {
    appendBackendLog(`\n[desktop] backend startup failed: ${error.message}\n`);
    dialog.showErrorBox("日序启动失败", `无法启动本地数据服务：${error.message}`);
    app.quit();
    return;
  }
  await mainWindow.loadURL(`http://127.0.0.1:${backendPort}/`);
  await mainWindow.webContents.insertCSS(`
    html::before {
      content: "";
      position: fixed;
      inset: 0 0 auto 0;
      height: 10px;
      z-index: 2147483647;
      -webkit-app-region: drag;
    }
  `);
}

function configureAutoUpdates() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      appendBackendLog(`\n[desktop] update check failed: ${error.message}\n`);
    });
  } catch (error) {
    appendBackendLog(`\n[desktop] updater unavailable: ${error.message}\n`);
  }
}

async function chooseWorkspace({ mode }) {
  const isExisting = mode === "existing";
  const result = await dialog.showOpenDialog(mainWindow, {
    title: isExisting ? "打开已有日序工作区" : "新建日序工作区",
    defaultPath: defaultWorkspacePath(),
    properties: isExisting ? ["openDirectory"] : ["openDirectory", "createDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const selectedPath = result.filePaths[0];
  const hasDb = fs.existsSync(path.join(selectedPath, "dayorder.db"));
  const hasConfig = fs.existsSync(path.join(selectedPath, "config.json"));
  if (isExisting && !hasDb && !hasConfig) {
    await dialog.showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["确定"],
      message: "请选择已有日序工作区",
      detail: "登录已有账户时只能打开包含 dayorder.db 或 config.json 的工作区。",
    });
    return null;
  }
  if (!isExisting) {
    if (hasDb || hasConfig) {
      await dialog.showMessageBox(mainWindow, {
        type: "warning",
        buttons: ["确定"],
        message: "请选择一个新的工作区地址",
        detail: "注册新账号时不能选择已经包含 dayorder.db 或 config.json 的日序工作区。",
      });
      return null;
    }
  }
  await openWorkspace(selectedPath);
  return selectedPath;
}

async function selectRegistrationStorage() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "选择初始化工作区地址",
    defaultPath: defaultWorkspacePath(),
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return "";
  return result.filePaths[0];
}

ipcMain.handle("desktop:get-state", () => {
  const config = readConfig();
  return {
    workspacePath: config.workspacePath || "",
    defaultWorkspacePath: defaultWorkspacePath(),
    logPath: path.join(logDir, "backend.log"),
  };
});

ipcMain.handle("desktop:open-default", async () => {
  await openWorkspace(defaultWorkspacePath());
  return defaultWorkspacePath();
});

ipcMain.handle("desktop:choose-workspace", async (_event, payload) => chooseWorkspace(payload || {}));
ipcMain.handle("desktop:select-registration-storage", async () => selectRegistrationStorage());

ipcMain.handle("desktop:reveal-logs", async () => {
  fs.mkdirSync(logDir, { recursive: true });
  await shell.openPath(logDir);
});

ipcMain.handle("desktop:reveal-workspace", async () => {
  const workspacePath = readConfig().workspacePath;
  if (workspacePath) await shell.openPath(workspacePath);
});

const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    createWindow();
    createTray();
    configureAutoUpdates();
    const config = readConfig();
    await openWorkspace(config.workspacePath && fs.existsSync(config.workspacePath) ? config.workspacePath : defaultWorkspacePath());
  });
}

app.on("before-quit", () => {
  isQuitting = true;
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
  if (isQuitting) app.quit();
});
