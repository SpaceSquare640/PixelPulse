import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { ActionConfig, RuleConfig, TriggerConfig } from '../protocol'
import { HTTP_ORIGIN } from '../serverConfig'

interface Props {
  rules: RuleConfig[]
  onToggle: (name: string, enabled: boolean) => void
  onEdit: (rule: RuleConfig) => void
  onDelete: (name: string) => void
  onDeleteAll: () => void
  onReorder: (names: string[]) => void
  onNewRule: () => void
  onBatchUpload: () => void
  batchUploading: boolean
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
  if (rule.trigger.kind === 'colour_pattern' && rule.trigger.colours && rule.trigger.colours.length > 0) {
    return (
      <span className="rule-card__thumb rule-card__thumb--multiswatch">
        {rule.trigger.colours.slice(0, 4).map((c, i) => (
          <span key={i} style={{ background: `rgb(${c.rgb.join(',')})` }} />
        ))}
      </span>
    )
  }
  return <span className="rule-card__thumb rule-card__thumb--empty" />
}

export function RuleList({
  rules,
  onToggle,
  onEdit,
  onDelete,
  onDeleteAll,
  onReorder,
  onNewRule,
  onBatchUpload,
  batchUploading,
}: Props) {
  const [dragName, setDragName] = useState<string | null>(null)
  const { t } = useLanguage()
  const hasPickerBridge = typeof window !== 'undefined' && !!window.pixelpulse

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

  function handleDeleteAll() {
    if (rules.length === 0) return
    if (window.confirm(t('ruleList.confirmDeleteAll', { count: rules.length }))) {
      onDeleteAll()
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{t('ruleList.title')}</h2>
        <div className="panel-header__actions">
          {rules.length > 0 && (
            <button type="button" className="button button--ghost" onClick={handleDeleteAll}>
              {t('ruleList.deleteAll')}
            </button>
          )}
          <button
            type="button"
            className="button"
            disabled={!hasPickerBridge || batchUploading}
            onClick={onBatchUpload}
          >
            {batchUploading ? t('ruleList.batchUploading') : t('ruleList.batchUpload')}
          </button>
          <button type="button" className="button button--primary" onClick={onNewRule}>
            {t('ruleList.newRule')}
          </button>
        </div>
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
                  {rule.trigger.roi == null && <span className="badge">{t('ruleList.badgeWholeScreen')}</span>}
                  {rule.oncePerAppearance && <span className="badge">{t('ruleList.badgeOncePerAppearance')}</span>}
                  {rule.dryRun && <span className="badge badge--warning">{t('ruleList.badgeDryRun')}</span>}
                </div>
              </div>
              <div className="rule-card__actions">
                <button type="button" className="button button--ghost" onClick={() => onEdit(rule)}>
                  {t('common.edit')}
                </button>
                <button type="button" className="button button--ghost" onClick={() => onDelete(rule.name)}>
                  {t('common.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
