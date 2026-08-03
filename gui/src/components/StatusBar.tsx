import { useLanguage } from '../i18n/LanguageContext'
import type { ConnectionState } from '../useEngineSocket'

interface Props {
  connectionState: ConnectionState
}

export function StatusBar({ connectionState }: Props) {
  const { t } = useLanguage()

  const labels: Record<ConnectionState, string> = {
    open: t('statusBar.connected'),
    connecting: t('statusBar.connecting'),
    closed: t('statusBar.disconnected'),
  }

  return (
    <header className="status-bar">
      <span className="app-title">PixelPulse</span>
      <span className={`connection-pill connection-pill--${connectionState}`}>
        <span className="dot" />
        {labels[connectionState]}
      </span>
    </header>
  )
}
