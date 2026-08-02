# PixelPulse — 核心引擎 + GUI（Phase 2）

English version: [README.md](README.md)

持續監控螢幕上的某個區域，跟目標圖片或指定像素顏色比對，命中後觸發滑鼠/鍵盤動作。
現在有兩種執行方式：

- **命令列**（Phase 1，仍可獨立使用）：直接用 `rules.json` 檔案驅動引擎，不需要 GUI。
- **GUI**（Phase 2）：Electron + React 前端透過本機 WebSocket 跟同一個引擎溝通，
  顯示連線/引擎狀態、已載入的規則，以及即時活動紀錄。

完整架構與開發時程請見 `PixelPulse_Document/` 裡的專案規劃（Phase 3 以後會加入
規則編輯器／ROI 選取工具、巨集系統、以及原生效能加速模組）。

## 環境建置（Python 核心）

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
```

## 執行 —— 只用命令列（無 GUI）

1. 裁切一張想偵測目標的截圖，放到 `targets/` 資料夾裡。
2. 複製 `rules.example.json` 為 `rules.json`，修改 `roi`（要監控的螢幕區域，絕對
   像素座標）與 `image` 路徑。
3. 執行：

```bash
python -m core.run rules.json
```

新規則預設 `"dryRun": true` —— 引擎只會記錄命中結果，不會真的點擊或輸入任何東西。
確認辨識穩定後，再手動把它改成 `false`。任何時候按下 `Ctrl+Alt+Q` 都能立即停止引擎。

## 執行 —— GUI（Electron）

1. 啟動 Python 伺服器（只綁定 `127.0.0.1:8765`，不對外開放）：

   ```bash
   python -m core.server --rules-path rules.json
   ```

2. 開另一個終端機，安裝並啟動 GUI：

   ```bash
   cd gui
   npm install
   npm run dev
   ```

   `npm run dev` 會同時啟動 Vite 開發伺服器與 Electron。關閉視窗只會縮到系統匣，
   不會真的結束程式 —— 要離開請用系統匣選單裡的「Quit」。

目前 GUI 會顯示連線／引擎狀態、從 `rules.json` 載入的規則清單，以及即時活動紀錄
（命中、觸發、dry-run、每條規則各自的錯誤）。還沒有規則編輯器 —— 現階段請手動編輯
`rules.json` 新增規則（Phase 3 會加入 ROI 選取工具與規則編輯器介面）。

## 測試

```bash
pytest                     # Python：核心引擎 + 伺服器（22 個測試）
cd gui && npm run build    # TypeScript：對前端做型別檢查
```

## 目錄結構

```
core/
├─ capture/        # 螢幕擷取 (mss)
├─ vision/         # 樣板匹配 + 像素顏色比對 (OpenCV/NumPy)
├─ automation/      # 滑鼠鍵盤後端 + 緊急停止熱鍵
├─ rules/          # 規則格式定義、JSON 讀取器、主掃描迴圈、引擎事件
├─ server/         # 包裝引擎、供 GUI 使用的 FastAPI + WebSocket 伺服器
├─ platform_windows.py
└─ run.py          # 命令列進入點（Phase 1，無 GUI）

gui/
├─ electron/       # Electron 主行程（視窗、系統匣）
└─ src/            # React 前端（狀態、引擎控制、規則清單、活動紀錄）
```
