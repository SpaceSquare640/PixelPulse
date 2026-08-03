import { useLanguage } from '../i18n/LanguageContext'
import type { ConnectionState } from '../useEngineSocket'

interface Props {
  connectionState: ConnectionState
  onOpenHelp: () => void
}

export function StatusBar({ connectionState, onOpenHelp }: Props) {
  const { lang, setLang, t } = useLanguage()

  const labels: Record<ConnectionState, string> = {
    open: t('statusBar.connected'),
    connecting: t('statusBar.connecting'),
    closed: t('statusBar.disconnected'),
  }

  return (
    <header className="status-bar">
      <span className="app-title">PixelPulse</span>
      <div className="status-bar__right">
        <span className={`connection-pill connection-pill--${connectionState}`}>
          <span className="dot" />
          {labels[connectionState]}
        </span>
        <div className="segmented lang-toggle">
          <button
            type="button"
            className={lang === 'zh' ? 'segmented__option segmented__option--active' : 'segmented__option'}
            onClick={() => setLang('zh')}
          >
            中文
          </button>
          <button
            type="button"
            className={lang === 'en' ? 'segmented__option segmented__option--active' : 'segmented__option'}
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>
        <button
          type="button"
          className="help-button"
          onClick={onOpenHelp}
          title={t('statusBar.help')}
          aria-label={t('statusBar.help')}
        >
          ?
        </button>
      </div>
    </header>
  )
}
