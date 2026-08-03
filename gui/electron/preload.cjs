// Preload script -- runs in an isolated context with access to Node/Electron
// APIs, and exposes a minimal, safe surface to the renderer via
// contextBridge. CommonJS on purpose (.cjs) so it loads reliably regardless
// of the project's "type": "module" setting.
//
// Preload 腳本 —— 在隔離的環境中執行、可以存取 Node/Electron API，並透過
// contextBridge 把最小、安全的介面暴露給前端。刻意用 CommonJS（.cjs），
// 不受專案 package.json "type": "module" 設定影響，載入更可靠。

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pixelpulse", {
  pickRegion: () => ipcRenderer.invoke("picker:start-region"),
  pickPoint: () => ipcRenderer.invoke("picker:start-point"),
  reportPickerResult: (result) => ipcRenderer.send("picker:result", result),
  pickImageFile: () => ipcRenderer.invoke("dialog:pick-image-file"),
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
});
