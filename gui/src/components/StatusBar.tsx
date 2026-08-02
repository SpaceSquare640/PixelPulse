import type { ConnectionState } from '../useEngineSocket'

const LABELS: Record<ConnectionState, string> = {
  open: 'Connected',
  connecting: 'Connecting…',
  closed: 'Disconnected',
}

export function StatusBar({ connectionState }: { connectionState: ConnectionState }) {
  return (
    <header className="status-bar">
      <span className="app-title">PixelPulse</span>
      <span className={`connection-pill connection-pill--${connectionState}`}>
        <span className="dot" />
        {LABELS[connectionState]}
      </span>
    </header>
  )
}
