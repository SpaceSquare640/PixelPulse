import type { RuleConfig } from '../protocol'

interface Props {
  rules: RuleConfig[]
  onToggle: (name: string, enabled: boolean) => void
  onDelete: (name: string) => void
}

export function RuleList({ rules, onToggle, onDelete }: Props) {
  return (
    <section className="panel">
      <h2>Rules</h2>
      {rules.length === 0 ? (
        <p className="muted">
          No rules yet. The rule editor lands in Phase 3 — for now, add entries to{' '}
          <code>rules.json</code> and reconnect.
        </p>
      ) : (
        <ul className="rule-list">
          {rules.map((rule) => (
            <li key={rule.name} className="rule-row">
              <label className="rule-row__toggle">
                <input
                  type="checkbox"
                  checked={rule.enabled ?? true}
                  onChange={(e) => onToggle(rule.name, e.target.checked)}
                />
                <span className="rule-row__name">{rule.name}</span>
              </label>
              <span className="badge">{rule.trigger.kind}</span>
              <span className="badge">{rule.action.kind}</span>
              {rule.dryRun && <span className="badge badge--warning">dry-run</span>}
              <button type="button" className="button button--ghost" onClick={() => onDelete(rule.name)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
