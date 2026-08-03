# PixelPulse — 核心引擎 + GUI（Phase 6）

English version: [README.md](README.md)

持續監控螢幕上的某個區域，跟目標圖片或指定像素顏色比對，命中後觸發滑鼠/鍵盤動作
——現在也支援多步驟巨集，並可用執行緒池平行掃描多條規則。現在有兩種執行方式：

- **命令列**（Phase 1，仍可獨立使用）：直接用 `rules.json` 檔案驅動引擎，不需要 GUI。
- **GUI**（Phase 2-6）：Electron + React 前端透過本機 WebSocket 跟同一個引擎溝通 ——
  連線/引擎狀態、附螢幕框選工具與即時比對預覽的規則編輯器、巨集步驟編輯器、可拖曳
  排序且有縮圖的規則清單，以及即時活動紀錄。現在打包成單一 Windows 安裝檔，
  Python 引擎已經內建在裡面 —— 不需要另外安裝 Python。

完整架構與開發時程請見 `PixelPulse_Document/` 裡的專案規劃。

## 取得應用程式（Windows 安裝檔）

到 [Releases](https://github.com/SpaceSquare640/PixelPulse/releases) 下載最新的
`PixelPulse-Setup-vX.Y.Z-windows.exe`，執行安裝程式，然後從開始功能表啟動
**PixelPulse**。安裝檔把 Python 引擎（`PixelPulse-Server.exe`，用 PyInstaller
打包）跟 Electron GUI 一起打包 —— App 啟動時會自動在背景啟動自己的引擎，
透過 `127.0.0.1:8765` 連線，跟下面手動開發的做法原理相同。規則與擷取到的樣板
圖片會存放在每個使用者各自的 `%APPDATA%\PixelPulse\` 資料夾裡。不需要系統管理員
權限，也不需要另外安裝 Python。

以下章節是給想從原始碼執行的人看的（開發用途，或只想用命令列、不需要 GUI）。

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

左側的側邊欄可以切換三個頁面：**規則**（規則清單 + 引擎啟動/停止）、
**活動紀錄**（即時事件紀錄），以及 **設定**（語言、App 版本、說明面板）。

點擊 **New Rule** 開啟規則編輯器：

1. **Trigger（觸發條件）** —— 選「Image (template)」或「Pixel colour」。選圖片
   觸發時，可以選擇圖片的來源：*Select Region on Screen*（拖曳框選，整個桌面會
   變暗只留下你正在選取的範圍）或 *Browse for Image File*（從硬碟選一張既有的
   圖片）。框選出來的區域可以另外勾選 **Scan the whole screen**，讓目標在螢幕
   任何地方出現都算命中，而不限於當初框選的那塊區域；上傳的圖片檔案則一律
   掃描整個螢幕（因為沒有對應的框選區域可以退回去用）。存檔前可以用
   **Test Match** 確認辨識準確。
2. **Action（動作）** —— 點擊、雙擊、按鍵、輸入文字，或是 **Macro（多步驟巨集）**。
3. **Safety（安全參數）** —— 名稱、可選的觸發上限、dry-run，以及「冷卻時間」
   （兩次觸發之間的最短間隔）或 **Only trigger once until it disappears and
   reappears**（只在目標出現時觸發一次，直到它消失後重新出現才會再觸發）兩者
   擇一 —— 給那種「目標一出現就要立刻反應、不需要想冷卻時間或次數次序設定」
   的規則用。

新規則一律先進入 dry-run，確認沒問題後再到規則清單把開關切成正式執行。拖曳規則卡片
左側的把手可以調整順序（規則按清單順序依序掃描）。

點擊規則卡片上的 **編輯** 可以重新開啟同一個三步驟編輯器，並預先帶入這條規則目前的
設定 —— 存檔會原地更新，不會新增重複的規則。規則清單標題列的 **刪除全部** 可以一次
清空所有規則（會先跳出確認）。

**設定** 頁面裡的 **說明** 按鈕，可以開啟應用程式內建的 **說明**面板 —— 教學手冊、
使用者須知、使用條款、免責聲明、隱私權政策，透過設定頁的語言切換（同一頁）都能看
繁體中文或英文版本。原始內容在 `gui/src/content/`。

### 更新機制

安裝好的 App 每次啟動都會檢查一次 GitHub Releases 有沒有新版本。發現新版本時，
會先跳出確認對話框——在你按下 **Update Now** 之前，不會下載或安裝任何東西。
如果發現新版本時引擎正在執行，會請你先手動停止引擎，而不是強行中斷它。確認之後，
會下載新的安裝檔、結束程式、靜默重新安裝（會替換安裝目錄裡的程式檔案；
`%APPDATA%\PixelPulse\` 裡的規則與擷取到的圖片完全不受影響），並自動重新開啟。
詳見 `gui/electron/updater.js`。

## 授權、免責聲明與使用者須知

PixelPulse 採用 [MIT 授權](LICENSE)。關鍵風險提醒請見
[DISCLAIMER.zh-TW.md](DISCLAIMER.zh-TW.md)（自動化辨識不會百分之百準確，把它用在
禁止自動化的服務上風險自負）；實務使用注意事項請見
[USER_NOTICE.zh-TW.md](USER_NOTICE.zh-TW.md)——兩者在 App 內的說明面板裡也看得到。

### 巨集（多步驟動作）

動作選「Macro (multi-step)」可以把好幾個步驟串在一起，取代單一動作：

- **Click / Double-click** —— 跟觸發條件一樣，在螢幕上框選一個目標圖片；巨集執行
  時會即時重新找出它的位置再點擊。
- **Wait for image** —— 等到某張目標圖片出現（例如等下一個畫面載入完成）才繼續。
- **Press key / Type text** —— 跟單步驟動作一樣。

每個步驟都有「執行前延遲」；需要在畫面上定位目標的步驟（click、double-click、
wait for image）另外有逾時時間與重試次數 —— 重試完還是找不到，巨集預設會中止，
並在活動紀錄裡顯示 `rule_error`；如果想改成「找不到就跳過這步、繼續下一步」，
可以直接編輯 `rules.json` 把該步驟的 `"onTimeout"` 設成 `"skip"`（編輯器介面目前
還沒有提供這個開關）。

## 自己建置 Windows 安裝檔

CI 在每次發佈時都會自動做這件事（見 `.github/workflows/release.yml`），
但要在本機重現的話：

```bash
pip install pyinstaller
pyinstaller --onefile --name PixelPulse-Server core/server/__main__.py
cd gui
npm ci
npm run electron:build
```

`electron:build`（`vite build && electron-builder`）會透過 `gui/package.json`
裡的 `extraResources` 設定，把 `dist/PixelPulse-Server.exe` 一起打包進去，
產生 `gui/dist/PixelPulse Setup <version>.exe`——一個把伺服器 exe 內建在
App `resources/` 資料夾裡的 NSIS 安裝檔。這個安裝檔沒有數位簽章（沒有憑證），
所以第一次執行時 Windows SmartScreen 可能會跳出警告；這是未簽章開源軟體的
正常現象，不代表檔案被竄改過。

## 效能：平行掃描

`cv2.matchTemplate`（本身已是原生 OpenCV 程式碼）主宰了掃描的耗時，而且它執行運算
期間會釋放 Python 的 GIL——所以把多條規則的掃描工作分散到執行緒池，不用寫任何
C++ 就能拿到真正的多核心加速（實測 4–16 個 workers 約有 ~3–4.6 倍加速；細節見
`benchmarks/` 與 `PixelPulse_Document/` 裡的 Phase 5 進度報告，裡面說明了為什麼
手寫 C++ 模組**不是**這裡該做的事）。用 `--max-workers N` 選擇性開啟：

```bash
python -m core.run rules.json --max-workers 4
python -m core.server --max-workers 4
```

GUI 伺服器預設是 `min(4, CPU 核心數)`；命令列版本預設維持 `1`（循序），保持行為
簡單、可預期。只有規則數量較多、或 ROI 較大時才有感——只有一兩條小規則的話沒什麼
好平行的。

## 測試

```bash
pytest                     # Python：核心引擎 + 伺服器（46 個測試）
cd gui && npm run build    # TypeScript：對前端做型別檢查
python -m benchmarks.bench_matching   # 效能：時間到底花在哪裡
python -m benchmarks.bench_parallel   # 效能：循序 vs 執行緒池
python -m benchmarks.bench_engine     # 效能：同上，但走真正的 RuleEngine 路徑
```

## 目錄結構

```
core/
├─ capture/        # 螢幕擷取 (mss)
├─ vision/         # 樣板匹配 + 像素顏色比對 (OpenCV/NumPy)
├─ automation/      # 滑鼠鍵盤後端 + 緊急停止熱鍵
├─ rules/
│  ├─ models.py     # 規則/觸發條件/動作/巨集步驟格式定義
│  ├─ engine.py      # 主掃描迴圈、引擎事件、可選的平行偵測
│  └─ macro.py        # MacroExecutor：執行多步驟動作
├─ server/         # FastAPI + WebSocket 伺服器：引擎控制、規則增刪改查、
│                   # 框選/點選擷取、即時比對預覽、供 GUI 縮圖用的 /targets 靜態檔案
├─ platform_windows.py
└─ run.py          # 命令列進入點（Phase 1，無 GUI）

benchmarks/         # Phase 5「先量測再優化」決策背後的效能測試腳本（見上方說明）

gui/
├─ electron/
│  ├─ main.js        # 視窗、系統匣、框選/點選工具視窗，以及（打包後的正式版）
│  │                  # 自動啟動內建伺服器 exe
│  ├─ updater.js     # GitHub 版本檢查、確認對話框、靜默重新安裝
│  └─ preload.cjs     # contextBridge -> window.pixelpulse.{pickRegion,pickPoint}
└─ src/
   ├─ components/
   │  ├─ RuleEditor.tsx      # 三步驟新增規則精靈
   │  ├─ MacroStepEditor.tsx  # 「macro」動作用的步驟清單編輯器
   │  ├─ PickerOverlay.tsx   # 顯示在透明框選視窗裡的內容
   │  ├─ RuleList.tsx        # 卡片清單、縮圖、拖曳排序
   │  ├─ Sidebar.tsx         # 左側導覽：規則／活動紀錄／設定
   │  ├─ SettingsPage.tsx    # 語言切換、App 版本、說明入口
   │  ├─ HelpModal.tsx       # 應用程式內的教學手冊/須知/條款/免責聲明/隱私（分頁，跟隨全域語言）
   │  ├─ EngineControls.tsx / LogPanel.tsx / StatusBar.tsx
   ├─ content/               # userManual.tsx / userNotice.tsx / termsOfService.tsx /
   │                         # disclaimer.tsx / privacyPolicy.tsx（英文 + 繁中）
   ├─ useEngineSocket.ts     # WebSocket 用戶端 + 請求/回應橋接
   └─ protocol.ts            # 對應 core/server/protocol.py
```
