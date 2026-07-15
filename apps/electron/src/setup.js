const desktop = window.dayOrderDesktop;
const defaultPath = document.querySelector("#defaultPath");
const statusText = document.querySelector("#status");
const buttons = [...document.querySelectorAll("button")];

function setBusy(message) {
  statusText.textContent = message;
  buttons.forEach((button) => {
    button.disabled = true;
  });
}

function clearBusy(message) {
  statusText.textContent = message;
  buttons.forEach((button) => {
    button.disabled = false;
  });
}

async function runStartup(action, startingText) {
  setBusy(startingText);
  try {
    const result = await action();
    if (!result) clearBusy("等待选择");
  } catch (error) {
    clearBusy(error.message || "启动失败");
  }
}

async function init() {
  const state = await desktop.getState();
  defaultPath.textContent = state.defaultWorkspacePath;
  desktop.onBackendStatus((message) => {
    statusText.textContent = message;
  });
}

document.querySelector("#defaultBtn").addEventListener("click", () => {
  runStartup(() => desktop.openDefaultWorkspace(), "正在初始化默认工作区...");
});

document.querySelector("#newBtn").addEventListener("click", () => {
  runStartup(() => desktop.chooseWorkspace("new"), "正在创建工作区...");
});

document.querySelector("#existingBtn").addEventListener("click", () => {
  runStartup(() => desktop.chooseWorkspace("existing"), "正在打开工作区...");
});

document.querySelector("#logsBtn").addEventListener("click", () => {
  desktop.revealLogs();
});

document.querySelector("#workspaceBtn").addEventListener("click", () => {
  desktop.revealWorkspace();
});

init();
