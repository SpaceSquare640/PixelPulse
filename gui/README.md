# PixelPulse GUI

Electron + React (TypeScript) shell around the PixelPulse core engine. See
the root [`../README.md`](../README.md) / [`../README.zh-TW.md`](../README.zh-TW.md)
for how to run this together with the Python server.

## Scripts

- `npm run dev` — Vite dev server + Electron together (hot reload)
- `npm run build` — type-check and build the renderer to `dist/`
- `npm run electron:build` — build the renderer, then package with electron-builder
- `npm run lint` — Oxlint
