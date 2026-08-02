// Electron main process: window + system tray shell around the React
// renderer, plus the screen region/point picker used by the rule editor
// (Phase 3). The main renderer still talks to the Python core directly over
// a plain browser WebSocket (ws://127.0.0.1:8765/ws) -- the preload/IPC
// bridge here exists only for things a web page truly can't do itself:
// opening a second, transparent, always-on-top window over the whole
// desktop to let the user drag-select a region or click a single pixel.
// See PixelPulse_Document/02 - 技術規劃/02 - UI-GUI-UX 設計.md.
//
// Electron 主行程：包住 React 前端的視窗與系統匣外殼，另外提供規則編輯器
// （Phase 3）用的螢幕框選/點選工具。主畫面的前端仍然直接用瀏覽器內建的
// WebSocket 跟 Python 核心溝通 —— 這裡的 preload/IPC 橋接只用來做網頁本身
// 做不到的事：開一個蓋住整個桌面、透明、置頂的第二個視窗，讓使用者拖曳框選
// 一塊區域，或點選單一像素。

import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRELOAD_PATH = path.join(__dirname, "preload.cjs");

let mainWindow = null;
let tray = null;
let isQuitting = false;

let pickerWindow = null;
let pendingPickerResolve = null;

function loadRenderer(window, queryString = "") {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    window.loadURL(`${devServerUrl}${queryString}`);
  } else {
    window.loadFile(path.join(__dirname, "../dist/index.html"), {
      search: queryString.replace(/^\?/, ""),
    });
  }
}

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
      preload: PRELOAD_PATH,
    },
  });

  loadRenderer(mainWindow);

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

// The union of every display's bounds, so one picker window can cover the
// whole multi-monitor desktop. Its top-left corner becomes the (originX,
// originY) the picker renderer uses to turn window-local coordinates back
// into absolute screen coordinates.
//
// 所有顯示器範圍的聯集，讓一個框選視窗就能蓋住整個多螢幕桌面。它的左上角
// 座標會當作 (originX, originY) 傳給框選畫面，用來把視窗內的相對座標換算回
// 螢幕絕對座標。
function getVirtualDesktopBounds() {
  const displays = screen.getAllDisplays();
  const left = Math.min(...displays.map((d) => d.bounds.x));
  const top = Math.min(...displays.map((d) => d.bounds.y));
  const right = Math.max(...displays.map((d) => d.bounds.x + d.bounds.width));
  const bottom = Math.max(...displays.map((d) => d.bounds.y + d.bounds.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function startPicker(mode) {
  if (pickerWindow) {
    return Promise.reject(new Error("A picker is already open."));
  }

  const bounds = getVirtualDesktopBounds();
  pickerWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: PRELOAD_PATH,
    },
  });
  pickerWindow.setAlwaysOnTop(true, "screen-saver");
  pickerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  loadRenderer(pickerWindow, `?picker=${mode}&originX=${bounds.x}&originY=${bounds.y}`);

  return new Promise((resolve) => {
    pendingPickerResolve = resolve;
  }).finally(() => {
    pickerWindow?.close();
    pickerWindow = null;
    pendingPickerResolve = null;
  });
}

ipcMain.handle("picker:start-region", () => startPicker("region"));
ipcMain.handle("picker:start-point", () => startPicker("point"));

// The picker renderer reports its result (or null on Escape/cancel) here;
// whichever invoke() call is currently pending gets resolved with it.
// 框選畫面把結果（或按 Escape 取消時的 null）回報到這裡；目前正在等待的
// invoke() 呼叫就會被這個結果解決。
ipcMain.on("picker:result", (_event, result) => {
  pendingPickerResolve?.(result);
});

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
