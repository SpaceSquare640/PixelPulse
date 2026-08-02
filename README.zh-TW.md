# PixelPulse — 核心引擎 + GUI（Phase 3）

English version: [README.md](README.md)

持續監控螢幕上的某個區域，跟目標圖片或指定像素顏色比對，命中後觸發滑鼠/鍵盤動作。
現在有兩種執行方式：

- **命令列**（Phase 1，仍可獨立使用）：直接用 `rules.json` 檔案驅動引擎，不需要 GUI。
- **GUI**（Phase 2+3）：Electron + React 前端透過本機 WebSocket 跟同一個引擎溝通 ——
  連線/引擎狀態、附螢幕框選工具與即時比對預覽的規則編輯器、可拖曳排序且有縮圖的
  規則清單，以及即時活動紀錄。

完整架構與開發時程請見 `PixelPulse_Document/` 裡的專案規劃（Phase 4 以後會加入
巨集系統與原生效能加速模組）。

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

點擊 **New Rule** 開啟規則編輯器：

1. **Trigger（觸發條件）** —— 選「Image (template)」或「Pixel colour」，然後點
   *Select Region on Screen* / *Pick a Point on Screen*。整個桌面會變暗，只留下你
   正在選取的範圍；拖曳框選一塊區域（或點選一個點）後放開，圖片/像素會立即擷取，
   縮圖或色塊會顯示出來。存檔前可以用 **Test Match** 確認辨識準確。
2. **Action（動作）** —— 點擊、雙擊、按鍵、或輸入文字。
3. **Safety（安全參數）** —— 名稱、冷卻時間、可選的觸發上限、dry-run。

新規則一律先進入 dry-run，確認沒問題後再到規則清單把開關切成正式執行。拖曳規則卡片
左側的把手可以調整順序（規則按清單順序依序掃描）。

## 測試

```bash
pytest                     # Python：核心引擎 + 伺服器（34 個測試）
cd gui && npm run build    # TypeScript：對前端做型別檢查
```

## 目錄結構

```
core/
├─ capture/        # 螢幕擷取 (mss)
├─ vision/         # 樣板匹配 + 像素顏色比對 (OpenCV/NumPy)
├─ automation/      # 滑鼠鍵盤後端 + 緊急停止熱鍵
├─ rules/          # 規則格式定義、JSON 讀取器、主掃描迴圈、引擎事件
├─ server/         # FastAPI + WebSocket 伺服器：引擎控制、規則增刪改查、
│                   # 框選/點選擷取、即時比對預覽、供 GUI 縮圖用的 /targets 靜態檔案
├─ platform_windows.py
└─ run.py          # 命令列進入點（Phase 1，無 GUI）

gui/
├─ electron/
│  ├─ main.js        # 視窗、系統匣、框選/點選工具視窗
│  └─ preload.cjs     # contextBridge -> window.pixelpulse.{pickRegion,pickPoint}
└─ src/
   ├─ components/
   │  ├─ RuleEditor.tsx      # 三步驟新增規則精靈
   │  ├─ PickerOverlay.tsx   # 顯示在透明框選視窗裡的內容
   │  ├─ RuleList.tsx        # 卡片清單、縮圖、拖曳排序
   │  ├─ EngineControls.tsx / LogPanel.tsx / StatusBar.tsx
   ├─ useEngineSocket.ts     # WebSocket 用戶端 + 請求/回應橋接
   └─ protocol.ts            # 對應 core/server/protocol.py
```
