// Electron main process: window + system tray shell around the React
// renderer. The renderer talks to the Python core directly over a plain
// browser WebSocket (ws://127.0.0.1:8765/ws), so no IPC/preload bridge is
// needed yet -- see PixelPulse_Document/02 - 技術規劃/02 - UI-GUI-UX 設計.md.
//
// Electron 主行程：包住 React 前端的視窗與系統匣外殼。前端直接用瀏覽器內建的
// WebSocket 跟 Python 核心溝通（ws://127.0.0.1:8765/ws），現階段不需要
// IPC/preload 橋接。

import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow = null;
let tray = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 680,
    minWidth: 400,
    minHeight: 500,
    title: "PixelPulse",
    backgroundColor: "#111318",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Closing the window hides it instead of quitting -- the engine keeps
  // running in the background (Python server), matching the tray-first UX
  // described in the plan doc. Only the tray's "Quit" item really exits.
  // 關閉視窗只是隱藏，不會真的結束程式 -- 引擎（Python 伺服器）在背景繼續跑，
  // 對應規劃文件裡「常駐系統匣」的設計。只有系統匣選單的「結束」才會真的離開。
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "assets", "icon.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 });
  tray = new Tray(icon);
  tray.setToolTip("PixelPulse");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show PixelPulse", click: () => mainWindow?.show() },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => mainWindow?.show());
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  // Intentionally not calling app.quit() here -- the app is meant to keep
  // living in the tray after the window closes.
});
