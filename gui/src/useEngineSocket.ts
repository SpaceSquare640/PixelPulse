import { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from './i18n/LanguageContext'
import type { ClientMessage, EngineEvent, RuleConfig, ServerMessage, TriggerConfig } from './protocol'
import { WS_URL } from './serverConfig'

const RECONNECT_DELAY_MS = 2000
const MAX_LOG_ENTRIES = 200
const REQUEST_TIMEOUT_MS = 10000

export type ConnectionState = 'connecting' | 'open' | 'closed'

export interface EngineStatus {
  running: boolean
  ruleCount: number
}

// Server replies that a specific request() call is waiting for, as opposed
// to unsolicited broadcasts (rule.list, engine.status, engine.event).
type ResponseMessage = Extract<ServerMessage, { type: 'capture.crop' | 'capture.pixel' | 'capture.import' | 'rule.preview' }>

interface PendingRequest {
  resolve: (message: ResponseMessage) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

function isResponseType(type: ServerMessage['type']): type is ResponseMessage['type'] {
  return type === 'capture.crop' || type === 'capture.pixel' || type === 'capture.import' || type === 'rule.preview'
}

export function useEngineSocket() {
  const { t } = useLanguage()
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [rules, setRules] = useState<RuleConfig[]>([])
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({ running: false, ruleCount: 0 })
  const [events, setEvents] = useState<EngineEvent[]>([])
  const [lastError, setLastError] = useState<string | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  // Tracks whether the component is still mounted, so a pending reconnect
  // timer doesn't fire after unmount and try to touch a stale socket.
  // 記錄元件是否仍在掛載中，避免元件卸載後，還有一個排定中的重連計時器
  // 觸發並嘗試操作已經失效的 socket。
  const mountedRef = useRef(true)
  // At most one in-flight request/response call at a time (capture.crop /
  // capture.pixel / rule.preview) -- the rule editor only ever awaits one
  // of these before letting the user act again, so no correlation id is
  // needed. An `error` reply while one is pending rejects it.
  // 同一時間最多只有一個進行中的請求/回應呼叫（capture.crop / capture.pixel /
  // rule.preview）—— 規則編輯器一次只會等待其中一個完成才會讓使用者繼續操作，
  // 所以不需要關聯 ID。若有請求正在等待時收到 `error`，就用它來 reject。
  const pendingRequestRef = useRef<PendingRequest | null>(null)

  useEffect(() => {
    mountedRef.current = true
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined

    function connect() {
      if (!mountedRef.current) return
      setConnectionState('connecting')
      const socket = new WebSocket(WS_URL)
      socketRef.current = socket

      // React StrictMode double-invokes this effect in development, which
      // can briefly leave a discarded first socket still finishing its
      // close handshake. Every handler re-checks that `socket` is still the
      // current one before touching state, so a stale socket can't double
      // up messages even if its close() call hasn't landed yet.
      //
      // React StrictMode 在開發模式下會把這個 effect 執行兩次，可能會讓
      // 被捨棄的第一個 socket 短暫殘留、還在完成關閉的交握。每個事件處理常式
      // 都會重新確認 `socket` 是不是目前使用中的那一個，這樣即使舊 socket
      // 的 close() 還沒真正生效，也不會讓訊息被重複處理。
      const isCurrent = () => socketRef.current === socket

      socket.onopen = () => {
        if (!mountedRef.current || !isCurrent()) return
        setConnectionState('open')
      }

      socket.onmessage = (raw) => {
        if (!isCurrent()) return
        const message: ServerMessage = JSON.parse(raw.data)

        const pending = pendingRequestRef.current
        if (pending && isResponseType(message.type)) {
          clearTimeout(pending.timer)
          pendingRequestRef.current = null
          pending.resolve(message as ResponseMessage)
        } else if (pending && message.type === 'error') {
          clearTimeout(pending.timer)
          pendingRequestRef.current = null
          pending.reject(new Error(message.message))
        }

        switch (message.type) {
          case 'rule.list':
            setRules(message.rules)
            break
          case 'engine.status':
            setEngineStatus({ running: message.running, ruleCount: message.ruleCount })
            break
          case 'engine.event':
            setEvents((prev) => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), message.event])
            break
          case 'error':
            setLastError(message.message)
            break
        }
      }

      socket.onclose = () => {
        if (!mountedRef.current || !isCurrent()) return
        setConnectionState('closed')
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      }

      socket.onerror = () => {
        socket.close()
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimer)
      socketRef.current?.close()
    }
  }, [])

  const send = useCallback((message: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message))
    }
  }, [])

  const request = useCallback((message: ClientMessage): Promise<ResponseMessage> => {
    return new Promise((resolve, reject) => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        reject(new Error(t('socket.notConnected')))
        return
      }
      if (pendingRequestRef.current) {
        reject(new Error(t('socket.requestInProgress')))
        return
      }
      const timer = setTimeout(() => {
        pendingRequestRef.current = null
        reject(new Error(t('socket.requestTimedOut')))
      }, REQUEST_TIMEOUT_MS)
      pendingRequestRef.current = { resolve, reject, timer }
      socketRef.current.send(JSON.stringify(message))
    })
  }, [t])

  const startEngine = useCallback(() => send({ type: 'engine.start' }), [send])
  const stopEngine = useCallback(() => send({ type: 'engine.stop' }), [send])
  const createRule = useCallback((payload: RuleConfig) => send({ type: 'rule.create', payload }), [send])
  const updateRule = useCallback(
    (originalName: string, payload: RuleConfig) => send({ type: 'rule.update', originalName, payload }),
    [send],
  )
  const deleteRule = useCallback((name: string) => send({ type: 'rule.delete', name }), [send])
  const deleteAllRules = useCallback(() => send({ type: 'rule.deleteAll' }), [send])
  const toggleRule = useCallback(
    (name: string, enabled: boolean) => send({ type: 'rule.toggle', name, enabled }),
    [send],
  )
  const reorderRules = useCallback((names: string[]) => send({ type: 'rule.reorder', names }), [send])

  const captureCrop = useCallback(
    async (roi: [number, number, number, number], name: string) => {
      const response = await request({ type: 'capture.crop', roi, name })
      if (response.type !== 'capture.crop') throw new Error('Unexpected response to capture.crop')
      return response
    },
    [request],
  )

  const capturePixel = useCallback(
    async (x: number, y: number) => {
      const response = await request({ type: 'capture.pixel', x, y })
      if (response.type !== 'capture.pixel') throw new Error('Unexpected response to capture.pixel')
      return response
    },
    [request],
  )

  const importImage = useCallback(
    async (path: string, name: string) => {
      const response = await request({ type: 'capture.import', path, name })
      if (response.type !== 'capture.import') throw new Error('Unexpected response to capture.import')
      return response
    },
    [request],
  )

  const previewTrigger = useCallback(
    async (trigger: TriggerConfig) => {
      const response = await request({ type: 'rule.preview', trigger })
      if (response.type !== 'rule.preview') throw new Error('Unexpected response to rule.preview')
      return response
    },
    [request],
  )

  return {
    connectionState,
    rules,
    engineStatus,
    events,
    lastError,
    startEngine,
    stopEngine,
    createRule,
    updateRule,
    deleteRule,
    deleteAllRules,
    toggleRule,
    reorderRules,
    captureCrop,
    capturePixel,
    importImage,
    previewTrigger,
  }
}
