# PixelPulse — Core Engine (Phase 1 MVP)

繁體中文版：[README.zh-TW.md](README.zh-TW.md)

Python-only core: no GUI yet. Watches a screen region, matches it against a
target image or pixel colour, and triggers a mouse/keyboard action when it
finds a hit. Driven entirely by a `rules.json` file from the command line.

See the project plan in `PixelPulse_Document/` for the full architecture and
roadmap (Phase 2+ adds the Electron GUI, macros, and native acceleration).

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
```

## Run

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

## Tests

```bash
pytest
```

## Layout

```
core/
├─ capture/       # screen grabbing (mss)
├─ vision/        # template matching + pixel colour matching (OpenCV/NumPy)
├─ automation/     # mouse/keyboard backend + emergency-stop hotkey
├─ rules/         # rule schema, JSON loader, main scan loop
├─ platform_windows.py
└─ run.py         # CLI entry point
```
