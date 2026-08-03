import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { ActionConfig, RuleConfig, TriggerConfig } from '../protocol'
import { HTTP_ORIGIN } from '../serverConfig'

interface Props {
  rules: RuleConfig[]
  onToggle: (name: string, enabled: boolean) => void
  onDelete: (name: string) => void
  onReorder: (names: string[]) => void
  onNewRule: () => void
}

function thumbnailFor(rule: RuleConfig) {
  if (rule.trigger.kind === 'template' && rule.trigger.image) {
    const filename = rule.trigger.image.split('/').pop()
    return <img className="rule-card__thumb" src={`${HTTP_ORIGIN}/targets/${filename}`} alt="" />
  }
  if (rule.trigger.kind === 'pixel' && rule.trigger.targetRgb) {
    return (
      <span
        className="rule-card__thumb rule-card__thumb--swatch"
        style={{ background: `rgb(${rule.trigger.targetRgb.join(',')})` }}
      />
    )
  }
  return <span className="rule-card__thumb rule-card__thumb--empty" />
}

export function RuleList({ rules, onToggle, onDelete, onReorder, onNewRule }: Props) {
  const [dragName, setDragName] = useState<string | null>(null)
  const { t } = useLanguage()

  function handleDrop(targetName: string) {
    if (!dragName || dragName === targetName) return
    const names = rules.map((r) => r.name)
    const from = names.indexOf(dragName)
    const to = names.indexOf(targetName)
    names.splice(from, 1)
    names.splice(to, 0, dragName)
    onReorder(names)
    setDragName(null)
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{t('ruleList.title')}</h2>
        <button type="button" className="button button--primary" onClick={onNewRule}>
          {t('ruleList.newRule')}
        </button>
      </div>
      {rules.length === 0 ? (
        <p className="muted">{t('ruleList.empty')}</p>
      ) : (
        <ul className="rule-list">
          {rules.map((rule) => (
            <li
              key={rule.name}
              className={`rule-card ${dragName === rule.name ? 'rule-card--dragging' : ''}`}
              draggable
              onDragStart={() => setDragName(rule.name)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(rule.name)}
              onDragEnd={() => setDragName(null)}
            >
              <span className="rule-card__handle" title={t('ruleList.dragToReorder')}>
                ⠿
              </span>
              {thumbnailFor(rule)}
              <div className="rule-card__body">
                <label className="rule-card__toggle">
                  <input
                    type="checkbox"
                    checked={rule.enabled ?? true}
                    onChange={(e) => onToggle(rule.name, e.target.checked)}
                  />
                  <span className="rule-card__name">{rule.name}</span>
                </label>
                <div className="rule-card__badges">
                  <span className="badge">{t(`triggerKind.${rule.trigger.kind as TriggerConfig['kind']}`)}</span>
                  <span className="badge">{t(`actionKind.${rule.action.kind as ActionConfig['kind']}`)}</span>
                  {rule.dryRun && <span className="badge badge--warning">{t('ruleList.badgeDryRun')}</span>}
                </div>
              </div>
              <button type="button" className="button button--ghost" onClick={() => onDelete(rule.name)}>
                {t('common.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
