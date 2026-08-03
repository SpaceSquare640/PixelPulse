import { useLanguage, type TranslateFn } from '../i18n/LanguageContext'
import type { EngineEvent } from '../protocol'

function describe(event: EngineEvent, t: TranslateFn): string {
  const at = event.x != null && event.y != null ? t('logPanel.atCoords', { x: event.x, y: event.y }) : ''
  const confidence =
    event.confidence != null ? t('logPanel.confidenceSuffix', { value: (event.confidence * 100).toFixed(1) }) : ''
  const name = event.rule_name ?? ''

  switch (event.type) {
    case 'engine_started':
      return event.rule_count != null
        ? t('logPanel.engineStartedWithCount', { count: event.rule_count })
        : t('logPanel.engineStarted')
    case 'engine_stopped':
      return t('logPanel.engineStopped')
    case 'rule_matched':
      return `${t('logPanel.ruleMatched', { name })}${at}${confidence}`
    // `at` is appended after the whole phrase (rather than mid-sentence)
    // so this key needs no second placeholder for the coordinate text.
    case 'rule_dry_run':
      return `${t('logPanel.ruleDryRun', { name })}${at}`
    case 'rule_triggered':
      return `${t('logPanel.ruleTriggered', { name })}${at}`
    case 'rule_error':
      return t('logPanel.ruleError', { name, message: event.message ?? t('logPanel.unknownError') })
    default:
      return event.type
  }
}

export function LogPanel({ events }: { events: EngineEvent[] }) {
  const { t } = useLanguage()
  const newestFirst = [...events].reverse()

  return (
    <section className="panel log-panel">
      <h2>{t('logPanel.title')}</h2>
      {newestFirst.length === 0 ? (
        <p className="muted">{t('logPanel.empty')}</p>
      ) : (
        <ul className="log-list">
          {newestFirst.map((event, i) => (
            <li key={`${event.timestamp}-${i}`} className={`log-entry log-entry--${event.type}`}>
              <time>{new Date(event.timestamp * 1000).toLocaleTimeString()}</time>
              <span>{describe(event, t)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
