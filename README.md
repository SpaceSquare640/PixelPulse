# PixelPulse — Core Engine + GUI (Phase 3)

繁體中文版：[README.zh-TW.md](README.zh-TW.md)

Watches a screen region, matches it against a target image or pixel colour,
and triggers a mouse/keyboard action when it finds a hit. Two ways to run
it:

- **CLI** (Phase 1, still works standalone): drive the engine straight from
  a `rules.json` file, no GUI required.
- **GUI** (Phase 2+3): an Electron + React front end talks to the same
  engine over a local WebSocket — connection/engine status, a rule editor
  with an on-screen region/point picker and live match preview, a
  drag-to-reorder rule list with thumbnails, and a live activity log.

See the project plan in `PixelPulse_Document/` for the full architecture and
roadmap (Phase 4+ adds macros and native acceleration).

## Setup (Python core)

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
```

## Run — CLI only (no GUI)

1. Crop a screenshot of the thing you want to detect and put it in `targets/`.
2. Copy `rules.example.json` to `rules.json` and edit the `roi` (screen
   region to watch, in absolute pixels) and `image` path.
3. Run:

```bash
python -m core.run rules.json
```

New rules default to `"dryRun": true` — the engine logs matches but does not
click or type anything. Flip it to `false` once you've confirmed detection is
stable. Press `Ctrl+Alt+Q` at any time to stop the engine immediately.

## Run — GUI (Electron)

1. Start the Python server (binds to `127.0.0.1:8765` only):

   ```bash
   python -m core.server --rules-path rules.json
   ```

2. In a second terminal, install and run the GUI:

   ```bash
   cd gui
   npm install
   npm run dev
   ```

   `npm run dev` starts the Vite dev server and Electron together. The
   window minimizes to the system tray on close instead of quitting — use
   the tray icon's "Quit" item to actually exit.

Click **New Rule** to open the editor:

1. **Trigger** — pick "Image (template)" or "Pixel colour", then click
   *Select Region on Screen* / *Pick a Point on Screen*. The whole desktop
   dims except the area you're selecting; drag a box (or click a point) and
   release. The image/pixel is captured immediately and a thumbnail/colour
   swatch shows up. Use **Test Match** to check it detects correctly before
   saving.
2. **Action** — click, double-click, key press, or typed text.
3. **Safety** — name, cooldown, optional trigger limit, and dry-run.

New rules always start in dry-run — flip the checkbox off in the rule list's
toggle once you trust it. Drag rule cards by the handle to reorder them
(rules are scanned in list order).

## Tests

```bash
pytest       # Python: core engine + server (34 tests)
cd gui && npm run build   # TypeScript: type-checks the renderer
```

## Layout

```
core/
├─ capture/       # screen grabbing (mss)
├─ vision/        # template matching + pixel colour matching (OpenCV/NumPy)
├─ automation/     # mouse/keyboard backend + emergency-stop hotkey
├─ rules/         # rule schema, JSON loader, main scan loop, engine events
├─ server/        # FastAPI + WebSocket server: engine control, rule CRUD,
│                  # region/point capture, live match preview, static
│                  # /targets file serving for GUI thumbnails
├─ platform_windows.py
└─ run.py         # CLI entry point (Phase 1, no GUI)

gui/
├─ electron/
│  ├─ main.js       # window, tray, and the region/point picker window
│  └─ preload.cjs    # contextBridge -> window.pixelpulse.{pickRegion,pickPoint}
└─ src/
   ├─ components/
   │  ├─ RuleEditor.tsx      # 3-step new-rule wizard
   │  ├─ PickerOverlay.tsx   # renders inside the transparent picker window
   │  ├─ RuleList.tsx        # card list, thumbnails, drag-to-reorder
   │  ├─ EngineControls.tsx / LogPanel.tsx / StatusBar.tsx
   ├─ useEngineSocket.ts     # WebSocket client + request/response bridge
   └─ protocol.ts            # mirrors core/server/protocol.py
```
