// Ambient type for the API exposed by electron/preload.cjs via contextBridge.
// electron/preload.cjs 透過 contextBridge 暴露的介面型別宣告。

export interface RegionPickResult {
  left: number
  top: number
  width: number
  height: number
}

export interface PointPickResult {
  x: number
  y: number
}

export interface PixelPulseBridge {
  pickRegion: () => Promise<RegionPickResult | null>
  pickPoint: () => Promise<PointPickResult | null>
  reportPickerResult: (result: RegionPickResult | PointPickResult | null) => void
}

declare global {
  interface Window {
    pixelpulse?: PixelPulseBridge
  }
}
