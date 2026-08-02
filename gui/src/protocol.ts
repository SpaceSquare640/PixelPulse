// WebSocket message protocol shared with the Python core. Mirrors
// core/server/protocol.py -- keep these two in sync by hand for now (no
// codegen yet).
//
// 與 Python 核心共用的 WebSocket 訊息協定，對應 core/server/protocol.py。
// 目前沒有自動產生程式碼，兩邊需要手動保持同步。

export type TriggerKind = 'template' | 'pixel'
export type ActionKind = 'click' | 'double_click' | 'key' | 'type'

export interface TriggerConfig {
  kind: TriggerKind
  roi: [number, number, number, number]
  image?: string | null
  threshold?: number
  pixelX?: number | null
  pixelY?: number | null
  targetRgb?: [number, number, number] | null
  tolerance?: number
}

export interface ActionConfig {
  kind: ActionKind
  button?: string
  key?: string | null
  text?: string | null
}

export interface RuleConfig {
  name: string
  trigger: TriggerConfig
  action: ActionConfig
  cooldownMs?: number
  maxTriggers?: number | null
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
}

// --- Client -> server --------------------------------------------------

export type ClientMessage =
  | { type: 'rule.create'; payload: RuleConfig }
  | { type: 'rule.list' }
  | { type: 'rule.delete'; name: string }
  | { type: 'rule.toggle'; name: string; enabled: boolean }
  | { type: 'engine.start' }
  | { type: 'engine.stop' }
  | { type: 'engine.status' }

// --- Server -> client --------------------------------------------------

export type ServerMessage =
  | { type: 'rule.list'; rules: RuleConfig[] }
  | { type: 'engine.status'; running: boolean; ruleCount: number }
  | { type: 'engine.event'; event: EngineEvent }
  | { type: 'error'; message: string }
