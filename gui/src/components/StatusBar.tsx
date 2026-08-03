import type { ConnectionState } from '../useEngineSocket'

const LABELS: Record<ConnectionState, string> = {
  open: 'Connected',
  connecting: 'Connecting…',
  closed: 'Disconnected',
}

interface Props {
  connectionState: ConnectionState
  onOpenHelp: () => void
}

export function StatusBar({ connectionState, onOpenHelp }: Props) {
  return (
    <header className="status-bar">
      <span className="app-title">PixelPulse</span>
      <div className="status-bar__right">
        <span className={`connection-pill connection-pill--${connectionState}`}>
          <span className="dot" />
          {LABELS[connectionState]}
        </span>
        <button type="button" className="help-button" onClick={onOpenHelp} title="Help / 說明" aria-label="Help">
          ?
        </button>
      </div>
    </header>
  )
}
