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

export interface ColourPickResult {
  rgb: [number, number, number]
  x: number
  y: number
}

export interface PixelPulseBridge {
  pickRegion: () => Promise<RegionPickResult | null>
  pickPoint: () => Promise<PointPickResult | null>
  pickColours: () => Promise<ColourPickResult[] | null>
  reportPickerResult: (result: RegionPickResult | PointPickResult | ColourPickResult[] | null) => void
  pickImageFile: () => Promise<string | null>
  pickImageFiles: () => Promise<string[] | null>
  getAppVersion: () => Promise<string>
}

declare global {
  interface Window {
    pixelpulse?: PixelPulseBridge
  }
}
