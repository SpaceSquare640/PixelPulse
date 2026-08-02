# PixelPulse — Core Engine + GUI (Phase 2)

繁體中文版：[README.zh-TW.md](README.zh-TW.md)

Watches a screen region, matches it against a target image or pixel colour,
and triggers a mouse/keyboard action when it finds a hit. Two ways to run
it:

- **CLI** (Phase 1, still works standalone): drive the engine straight from
  a `rules.json` file, no GUI required.
- **GUI** (Phase 2): an Electron + React front end talks to the same engine
  over a local WebSocket, showing connection/engine status, the loaded
  rules, and a live activity log.

See the project plan in `PixelPulse_Document/` for the full architecture and
roadmap (Phase 3+ adds the rule editor / ROI picker, macros, and native
acceleration).

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

The GUI currently shows connection/engine status, the rules loaded from
`rules.json`, and a live activity log (matches, triggers, dry-runs, and
per-rule errors). There's no rule editor yet — add rules by hand to
`rules.json` for now (Phase 3 adds the ROI picker and rule editor UI).

## Tests

```bash
pytest       # Python: core engine + server (22 tests)
cd gui && npm run build   # TypeScript: type-checks the renderer
```

## Layout

```
core/
├─ capture/       # screen grabbing (mss)
├─ vision/        # template matching + pixel colour matching (OpenCV/NumPy)
├─ automation/     # mouse/keyboard backend + emergency-stop hotkey
├─ rules/         # rule schema, JSON loader, main scan loop, engine events
├─ server/        # FastAPI + WebSocket server wrapping the engine for the GUI
├─ platform_windows.py
└─ run.py         # CLI entry point (Phase 1, no GUI)

gui/
├─ electron/      # Electron main process (window, tray)
└─ src/           # React renderer (status, engine controls, rule list, log)
```
