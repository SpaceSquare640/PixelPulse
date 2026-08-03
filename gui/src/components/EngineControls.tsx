import { useLanguage } from '../i18n/LanguageContext'
import type { EngineStatus } from '../useEngineSocket'

interface Props {
  connected: boolean
  status: EngineStatus
  onStart: () => void
  onStop: () => void
}

export function EngineControls({ connected, status, onStart, onStop }: Props) {
  const { t } = useLanguage()

  return (
    <section className="panel engine-controls">
      <div>
        <div className={`engine-state engine-state--${status.running ? 'running' : 'stopped'}`}>
          <span className="dot" />
          {status.running ? t('engineControls.running') : t('engineControls.stopped')}
        </div>
        <p className="muted">{t('engineControls.ruleCountLoaded', { count: status.ruleCount })}</p>
      </div>
      <button
        type="button"
        className={status.running ? 'button button--danger' : 'button button--primary'}
        disabled={!connected}
        onClick={status.running ? onStop : onStart}
      >
        {status.running ? t('engineControls.stop') : t('engineControls.start')}
      </button>
    </section>
  )
}
