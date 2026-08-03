# PixelPulse — Core Engine + GUI (Phase 6)

繁體中文版：[README.zh-TW.md](README.zh-TW.md)

Watches a screen region, matches it against a target image or pixel colour,
and triggers a mouse/keyboard action — including multi-step macros — when it
finds a hit. Two ways to run it:

- **CLI** (Phase 1, still works standalone): drive the engine straight from
  a `rules.json` file, no GUI required.
- **GUI** (Phase 2-6): an Electron + React front end talks to the same
  engine over a local WebSocket — connection/engine status, a rule editor
  with an on-screen region/point picker, live match preview, a macro step
  editor, a drag-to-reorder rule list with thumbnails, and a live activity
  log. Ships as a single Windows installer with the Python engine bundled
  inside — no separate Python setup required.

See the project plan in `PixelPulse_Document/` for the full architecture and
roadmap.

## Get the app (Windows installer)

Download the latest `PixelPulse-Setup-vX.Y.Z-windows.exe` from
[Releases](https://github.com/SpaceSquare640/PixelPulse/releases), run it,
and launch **PixelPulse** from the Start Menu. The installer bundles the
Python engine (`PixelPulse-Server.exe`, built with PyInstaller) alongside the
Electron GUI — the app starts its own engine automatically in the
background on launch, connecting over `127.0.0.1:8765` the same way the dev
setup below does manually. Rules and captured template images are stored
per-user under `%APPDATA%\PixelPulse\`. No admin rights or separate Python
install needed.

The sections below are for running from source (development, or the
CLI-only workflow without the GUI).

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

The sidebar on the left switches between three pages: **Rules** (rule list +
engine start/stop), **Activity** (the live event log), and **Settings**
(language, app version, and the Help panel).

Click **New Rule** to open the editor:

1. **Trigger** — pick "Image (template)" or "Pixel colour". For an image
   trigger, choose how to supply it: *Select Region on Screen* (drag a box;
   the whole desktop dims except the area you're selecting) or *Browse for
   Image File* (pick an existing image from disk). A screen-cropped region
   can optionally check **Scan the whole screen** to match the target
   anywhere rather than just where it was captured; an uploaded file always
   scans the whole screen (there's no region to fall back to). Use
   **Test Match** to check it detects correctly before saving.
2. **Action** — click, double-click, key press, typed text, or **Macro
   (multi-step)**.
3. **Safety** — name, an optional trigger limit, dry-run, and either a
   cooldown (minimum time between triggers) or **Only trigger once until it
   disappears and reappears** — for a rule that should fire the instant its
   target shows up, with no cooldown or count/order settings to think about.

New rules always start in dry-run — flip the checkbox off in the rule list's
toggle once you trust it. Drag rule cards by the handle to reorder them
(rules are scanned in list order).

Click **Edit** on any rule card to reopen the same 3-step editor pre-filled
with that rule's current settings — save to update it in place instead of
creating a duplicate. **Delete All** in the rule list header clears every
rule at once (with a confirmation prompt first).

The **Help** button on the Settings page opens the in-app **Help** panel —
a user manual, user notice, terms of service, disclaimer, and privacy
policy, each available in English and 繁體中文 via the language switcher
(also on the Settings page). Source: `gui/src/content/`.

## License, disclaimer, and user notice

PixelPulse is [MIT licensed](LICENSE). See [DISCLAIMER.md](DISCLAIMER.md) for
the key risk points (automation is imprecise, and using it against a
service that prohibits automation is at your own risk) and
[USER_NOTICE.md](USER_NOTICE.md) for practical usage notes — both also
available inside the app's Help panel.

### Macros (multi-step actions)

Pick "Macro (multi-step)" as the action to chain several steps together
instead of one:

- **Click** / **Double-click** — pick a target image on screen (like the
  trigger step); the macro re-locates it fresh at run time and clicks it.
- **Wait for image** — pause until a target image appears (e.g. wait for the
  next screen to load) before continuing.
- **Press key** / **Type text** — same as the single-step actions.

Each step has a delay-before, and the target-locating steps (click,
double-click, wait for image) have a timeout and retry count — if the
target still isn't found after retrying, the macro aborts (by default) and
reports a `rule_error` you'll see in the activity log; this can be changed
to skip that step instead by editing `"onTimeout": "skip"` directly in
`rules.json` (not yet exposed as a toggle in the editor UI).

## Building the Windows installer yourself

CI does this automatically for every release (see
`.github/workflows/release.yml`), but to reproduce it locally:

```bash
pip install pyinstaller
pyinstaller --onefile --name PixelPulse-Server core/server/__main__.py
cd gui
npm ci
npm run electron:build
```

`electron:build` (`vite build && electron-builder`) picks up
`dist/PixelPulse-Server.exe` via the `extraResources` entry in
`gui/package.json` and produces `gui/dist/PixelPulse Setup <version>.exe` —
an NSIS installer with the server exe bundled into the app's `resources/`
folder. The installer isn't code-signed (no certificate), so Windows
SmartScreen may warn on first run; that's expected for an unsigned
open-source build, not a sign of tampering.

## Performance: parallel scanning

`cv2.matchTemplate` (already native OpenCV code) dominates scan cost, and it
releases Python's GIL while running — so scanning many rules across a
thread pool gives real multi-core speedup with zero custom C++ (benchmarked
~3–4.6x with 4–16 workers; see `benchmarks/` and the Phase 5 progress report
in `PixelPulse_Document/` for why a hand-written C++ module was *not* the
right move here). Opt in with `--max-workers N`:

```bash
python -m core.run rules.json --max-workers 4
python -m core.server --max-workers 4
```

The GUI server defaults to `min(4, cpu_count)`; the CLI defaults to `1`
(sequential) to keep its behaviour simple and predictable. Only worth
raising if you have several rules and/or large ROIs — with just a couple of
small rules there's nothing to parallelize.

## Tests

```bash
pytest       # Python: core engine + server (46 tests)
cd gui && npm run build   # TypeScript: type-checks the renderer
python -m benchmarks.bench_matching   # perf: where the time actually goes
python -m benchmarks.bench_parallel   # perf: sequential vs thread-pool
python -m benchmarks.bench_engine     # perf: same, through the real RuleEngine path
```

## Layout

```
core/
├─ capture/       # screen grabbing (mss)
├─ vision/        # template matching + pixel colour matching (OpenCV/NumPy)
├─ automation/     # mouse/keyboard backend + emergency-stop hotkey
├─ rules/
│  ├─ models.py    # rule/trigger/action/macro-step schema
│  ├─ engine.py     # main scan loop, engine events, optional parallel detection
│  └─ macro.py       # MacroExecutor: runs a multi-step action
├─ server/        # FastAPI + WebSocket server: engine control, rule CRUD,
│                  # region/point capture, live match preview, static
│                  # /targets file serving for GUI thumbnails
├─ platform_windows.py
└─ run.py         # CLI entry point (Phase 1, no GUI)

benchmarks/        # perf scripts backing the Phase 5 "measure before
                    # optimizing" decision (see README section above)

gui/
├─ electron/
│  ├─ main.js       # window, tray, region/point picker window, and (in a
│  │                 # packaged build) spawning the bundled server exe
│  └─ preload.cjs    # contextBridge -> window.pixelpulse.{pickRegion,pickPoint}
└─ src/
   ├─ components/
   │  ├─ RuleEditor.tsx      # 3-step new-rule wizard
   │  ├─ MacroStepEditor.tsx  # step list editor for the "macro" action
   │  ├─ PickerOverlay.tsx   # renders inside the transparent picker window
   │  ├─ RuleList.tsx        # card list, thumbnails, drag-to-reorder
   │  ├─ Sidebar.tsx         # left nav: Rules / Activity / Settings
   │  ├─ SettingsPage.tsx    # language switcher, app version, Help trigger
   │  ├─ HelpModal.tsx       # in-app manual/notice/terms/disclaimer/privacy (tabs, follows global language)
   │  ├─ EngineControls.tsx / LogPanel.tsx / StatusBar.tsx
   ├─ content/               # userManual.tsx / userNotice.tsx / termsOfService.tsx /
   │                         # disclaimer.tsx / privacyPolicy.tsx (EN + zh-TW)
   ├─ useEngineSocket.ts     # WebSocket client + request/response bridge
   └─ protocol.ts            # mirrors core/server/protocol.py
```
