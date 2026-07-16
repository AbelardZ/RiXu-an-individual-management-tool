const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dayOrderDesktop", {
  getState: () => ipcRenderer.invoke("desktop:get-state"),
  openDefaultWorkspace: () => ipcRenderer.invoke("desktop:open-default"),
  chooseWorkspace: (mode) => ipcRenderer.invoke("desktop:choose-workspace", { mode }),
  selectRegistrationStorage: () => ipcRenderer.invoke("desktop:select-registration-storage"),
  revealLogs: () => ipcRenderer.invoke("desktop:reveal-logs"),
  revealWorkspace: () => ipcRenderer.invoke("desktop:reveal-workspace"),
  onBackendLog: (callback) => ipcRenderer.on("backend:log", (_event, text) => callback(text)),
  onBackendStatus: (callback) => ipcRenderer.on("backend:status", (_event, text) => callback(text)),
  // 背景图持久化
  savePomodoroBg: (dataUrl) => ipcRenderer.invoke("desktop:save-pomodoro-bg", dataUrl),
  loadPomodoroBg: () => ipcRenderer.invoke("desktop:load-pomodoro-bg"),
});
