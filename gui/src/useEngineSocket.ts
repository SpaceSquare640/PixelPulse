import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientMessage, EngineEvent, RuleConfig, ServerMessage } from './protocol'

const WS_URL = 'ws://127.0.0.1:8765/ws'
const RECONNECT_DELAY_MS = 2000
const MAX_LOG_ENTRIES = 200

export type ConnectionState = 'connecting' | 'open' | 'closed'

export interface EngineStatus {
  running: boolean
  ruleCount: number
}

export function useEngineSocket() {
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

  const startEngine = useCallback(() => send({ type: 'engine.start' }), [send])
  const stopEngine = useCallback(() => send({ type: 'engine.stop' }), [send])
  const deleteRule = useCallback((name: string) => send({ type: 'rule.delete', name }), [send])
  const toggleRule = useCallback(
    (name: string, enabled: boolean) => send({ type: 'rule.toggle', name, enabled }),
    [send],
  )

  return {
    connectionState,
    rules,
    engineStatus,
    events,
    lastError,
    startEngine,
    stopEngine,
    deleteRule,
    toggleRule,
  }
}
