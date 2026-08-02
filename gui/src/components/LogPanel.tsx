import type { EngineEvent } from '../protocol'

function describe(event: EngineEvent): string {
  const at = event.x != null && event.y != null ? ` at (${event.x}, ${event.y})` : ''
  const confidence = event.confidence != null ? ` — ${(event.confidence * 100).toFixed(1)}%` : ''

  switch (event.type) {
    case 'engine_started':
      return `Engine started${event.message ? ` (${event.message})` : ''}`
    case 'engine_stopped':
      return 'Engine stopped'
    case 'rule_matched':
      return `"${event.rule_name}" matched${at}${confidence}`
    case 'rule_dry_run':
      return `"${event.rule_name}" would have triggered${at} (dry-run, no action taken)`
    case 'rule_triggered':
      return `"${event.rule_name}" triggered${at}`
    case 'rule_error':
      return `"${event.rule_name}" failed: ${event.message ?? 'unknown error'} (rule disabled for this run)`
    default:
      return event.type
  }
}

export function LogPanel({ events }: { events: EngineEvent[] }) {
  const newestFirst = [...events].reverse()

  return (
    <section className="panel log-panel">
      <h2>Activity</h2>
      {newestFirst.length === 0 ? (
        <p className="muted">No activity yet.</p>
      ) : (
        <ul className="log-list">
          {newestFirst.map((event, i) => (
            <li key={`${event.timestamp}-${i}`} className={`log-entry log-entry--${event.type}`}>
              <time>{new Date(event.timestamp * 1000).toLocaleTimeString()}</time>
              <span>{describe(event)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
