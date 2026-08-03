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

import { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, screen } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkForUpdates } from "./updater.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRELOAD_PATH = path.join(__dirname, "preload.cjs");

// package.json's top-level "name" is "gui" (the npm workspace's internal
// name) -- without this, app.getName() falls back to that and every
// per-user data path (app.getPath("userData"), the crash-dump folder, etc.)
// would live under a confusing "%APPDATA%\gui" instead of "...\PixelPulse".
// Must be set before any app.getPath() call, so it runs at module load time.
//
// package.json 最上層的 "name" 是 "gui"（npm workspace 內部用的名稱）——
// 沒有這行，app.getName() 就會退回用那個名稱，導致每個使用者專屬的資料路徑
// （app.getPath("userData")、當機傾印資料夾等）都會變成令人困惑的
// "%APPDATA%\gui"，而不是「...\PixelPulse」。必須在任何 app.getPath()
// 呼叫之前設定，所以放在模組載入時就執行。
app.setName("PixelPulse");

let mainWindow = null;
let tray = null;
let isQuitting = false;

let pickerWindow = null;
let pendingPickerResolve = null;

let serverProcess = null;

// In dev (`npm run dev`), the Python server is started by hand in a separate
// terminal, same as the CLI-only workflow -- this only kicks in for a
// packaged build, where there's no terminal for the user to run it from.
// The bundled PixelPulse-Server.exe (built by PyInstaller, see
// .github/workflows/release.yml and gui/package.json's `build.extraResources`)
// ships in the installed app's resources/ folder next to the renderer.
//
// 開發模式（`npm run dev`）下，Python 伺服器是手動在另一個終端機啟動的，跟
// 純 CLI 的工作流程一樣 -- 這段程式碼只在打包後的正式版才會用到，因為使用者
// 沒有終端機可以手動啟動伺服器。打包好的 PixelPulse-Server.exe（由 PyInstaller
// 建置，見 .github/workflows/release.yml 與 gui/package.json 的
// `build.extraResources`）會放在安裝後 App 的 resources/ 資料夾裡，
// 跟前端檔案放在一起。
function startBundledServer() {
  if (!app.isPackaged) return;

  const exePath = path.join(process.resourcesPath, "PixelPulse-Server.exe");
  if (!fs.existsSync(exePath)) {
    console.error(`Bundled server not found at ${exePath}`);
    return;
  }

  // Rules/targets live in the per-user app-data folder, not next to the exe
  // (which sits under Program Files and isn't writable without admin rights).
  // 規則與樣板圖片放在每個使用者各自的 app-data 資料夾，而不是跟 exe 放在一起
  // （exe 在 Program Files 底下，一般使用者沒有系統管理員權限無法寫入）。
  const userDataDir = app.getPath("userData");
  const rulesPath = path.join(userDataDir, "rules.json");
  const targetsDir = path.join(userDataDir, "targets");
  fs.mkdirSync(targetsDir, { recursive: true });

  serverProcess = spawn(
    exePath,
    ["--rules-path", rulesPath, "--targets-dir", targetsDir, "--host", "127.0.0.1", "--port", "8765"],
    { windowsHide: true },
  );
  serverProcess.stdout?.on("data", (data) => console.log(`[server] ${data}`.trimEnd()));
  serverProcess.stderr?.on("data", (data) => console.error(`[server] ${data}`.trimEnd()));
  serverProcess.on("exit", (code, signal) => {
    console.log(`PixelPulse server exited (code=${code}, signal=${signal})`);
    serverProcess = null;
  });
}

function stopBundledServer() {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
  }
  serverProcess = null;
}

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

// Native "browse for an existing image file" alternative to cropping a live
// screen selection -- for when the user already has a reference image (e.g.
// a saved icon) instead of wanting to capture one from the screen.
//
// 原生的「瀏覽選擇既有圖片檔案」功能，是框選即時畫面以外的另一種做法 ——
// 給已經有現成參考圖片（例如存好的圖示）、不需要從螢幕擷取的使用者用。
ipcMain.handle("dialog:pick-image-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select an image",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "bmp", "webp"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Lets the renderer show the running app's own version (Settings page) --
// reads from package.json (dev) or the packaged app's metadata, same value
// electron-builder stamps into the installer.
// 讓前端能顯示目前執行中 App 自己的版本號（設定頁用）—— 讀取的是
// package.json（開發模式）或打包後 App 本身的中繼資料，跟 electron-builder
// 蓋在安裝檔上的版本號是同一個值。
ipcMain.handle("app:get-version", () => app.getVersion());

app.whenReady().then(() => {
  startBundledServer();
  createWindow();
  createTray();
  // Fire-and-forget: never blocks window creation, and only prompts the
  // user (never installs anything) without their explicit confirmation.
  // 不等待、不阻塞視窗建立；沒有經過使用者明確確認之前，這裡只會跳提示，
  // 不會真的安裝任何東西。
  checkForUpdates().catch((err) => console.error("Update check crashed:", err));
});

app.on("before-quit", () => {
  isQuitting = true;
  stopBundledServer();
});

app.on("window-all-closed", () => {
  // Intentionally not calling app.quit() here -- the app is meant to keep
  // living in the tray after the window closes.
});
