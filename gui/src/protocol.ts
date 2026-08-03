// WebSocket message protocol shared with the Python core. Mirrors
// core/server/protocol.py -- keep these two in sync by hand for now (no
// codegen yet).
//
// 與 Python 核心共用的 WebSocket 訊息協定，對應 core/server/protocol.py。
// 目前沒有自動產生程式碼，兩邊需要手動保持同步。

export type TriggerKind = 'template' | 'pixel' | 'colour_pattern'
export type ActionKind = 'click' | 'double_click' | 'key' | 'type' | 'macro'
export type MacroStepKind = 'click' | 'double_click' | 'key' | 'type' | 'wait_for'

// One key colour in a "像素圖" (Pixel Map / colour_pattern) trigger's colour
// set. offsetX/offsetY only describe the rough size of the original capture
// (sizes the default cluster search radius) -- never compared to each other
// at detection time, since the point is to tolerate the target rotating.
export interface ColourPoint {
  rgb: [number, number, number]
  offsetX?: number
  offsetY?: number
}

export interface TriggerConfig {
  kind: TriggerKind
  // null means "scan the whole screen" instead of a fixed region.
  roi: [number, number, number, number] | null
  image?: string | null
  threshold?: number
  pixelX?: number | null
  pixelY?: number | null
  targetRgb?: [number, number, number] | null
  tolerance?: number
  // colour_pattern ("像素圖") trigger
  colours?: ColourPoint[] | null
  minMatches?: number
  clusterRadius?: number
}

// Mirrors core/rules/models.py's MacroStep (Phase 4).
export interface MacroStep {
  kind: MacroStepKind
  // click / double_click / wait_for: locate `target` via template match.
  target?: string | null
  roi?: [number, number, number, number] | null
  threshold?: number
  // click / double_click fallback when `target` is not set.
  x?: number | null
  y?: number | null
  button?: string
  // key / type
  key?: string | null
  text?: string | null
  // timing / retry
  delayBeforeMs?: number
  timeoutMs?: number
  onTimeout?: 'abort' | 'skip'
  retryCount?: number
  retryDelayMs?: number
}

export interface ActionConfig {
  kind: ActionKind
  button?: string
  key?: string | null
  text?: string | null
  // Only set when kind === 'macro'.
  steps?: MacroStep[] | null
}

export interface RuleConfig {
  name: string
  trigger: TriggerConfig
  action: ActionConfig
  cooldownMs?: number
  maxTriggers?: number | null
  // When true, cooldownMs is ignored and the rule fires once when the
  // target appears, then stays silent until it disappears and reappears.
  oncePerAppearance?: boolean
  dryRun?: boolean
  enabled?: boolean
}

export type EngineEventType =
  | 'engine_started'
  | 'engine_stopped'
  | 'rule_matched'
  | 'rule_triggered'
  | 'rule_dry_run'
  | 'rule_error'

export interface EngineEvent {
  type: EngineEventType
  timestamp: number
  rule_name: string | null
  x: number | null
  y: number | null
  confidence: number | null
  message: string | null
  rule_count: number | null
}

// --- Client -> server --------------------------------------------------

export type ClientMessage =
  | { type: 'rule.create'; payload: RuleConfig }
  | { type: 'rule.update'; originalName: string; payload: RuleConfig }
  | { type: 'rule.list' }
  | { type: 'rule.delete'; name: string }
  | { type: 'rule.deleteAll' }
  | { type: 'rule.toggle'; name: string; enabled: boolean }
  | { type: 'rule.reorder'; names: string[] }
  | { type: 'rule.preview'; trigger: TriggerConfig }
  | { type: 'capture.crop'; roi: [number, number, number, number]; name: string }
  | { type: 'capture.pixel'; x: number; y: number }
  | { type: 'capture.import'; path: string; name: string }
  | { type: 'capture.detectColours'; imagePath: string; maxColours?: number }
  | { type: 'engine.start' }
  | { type: 'engine.stop' }
  | { type: 'engine.status' }

// --- Server -> client --------------------------------------------------

export type ServerMessage =
  | { type: 'rule.list'; rules: RuleConfig[] }
  | { type: 'engine.status'; running: boolean; ruleCount: number }
  | { type: 'engine.event'; event: EngineEvent }
  | { type: 'rule.preview'; matched: boolean; x?: number | null; y?: number | null; confidence?: number | null }
  | { type: 'capture.crop'; imagePath: string; previewPngBase64: string; roi: [number, number, number, number] }
  | { type: 'capture.pixel'; x: number; y: number; targetRgb: [number, number, number] }
  | { type: 'capture.import'; imagePath: string; previewPngBase64: string }
  | { type: 'capture.detectColours'; colours: ColourPoint[] }
  | { type: 'error'; message: string }
