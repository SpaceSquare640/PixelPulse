# PixelPulse — 核心引擎（Phase 1 MVP）

English version: [README.md](README.md)

純 Python 核心，目前還沒有 GUI。持續監控螢幕上的某個區域，跟目標圖片或指定像素
顏色比對，命中後觸發滑鼠/鍵盤動作。全程由命令列的 `rules.json` 檔案驅動。

完整架構與開發時程請見 `PixelPulse_Document/` 裡的專案規劃（Phase 2 以後會加入
Electron GUI、巨集系統、以及原生效能加速模組）。

## 環境建置

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
```

## 執行

1. 裁切一張想偵測目標的截圖，放到 `targets/` 資料夾裡。
2. 複製 `rules.example.json` 為 `rules.json`，修改 `roi`（要監控的螢幕區域，絕對
   像素座標）與 `image` 路徑。
3. 執行：

```bash
python -m core.run rules.json
```

新規則預設 `"dryRun": true` —— 引擎只會記錄命中結果，不會真的點擊或輸入任何東西。
確認辨識穩定後，再手動把它改成 `false`。任何時候按下 `Ctrl+Alt+Q` 都能立即停止引擎。

## 測試

```bash
pytest
```

## 目錄結構

```
core/
├─ capture/        # 螢幕擷取 (mss)
├─ vision/         # 樣板匹配 + 像素顏色比對 (OpenCV/NumPy)
├─ automation/      # 滑鼠鍵盤後端 + 緊急停止熱鍵
├─ rules/          # 規則格式定義、JSON 讀取器、主掃描迴圈
├─ platform_windows.py
└─ run.py          # 命令列進入點
```
