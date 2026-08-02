import { useState } from 'react'
import type { MacroStep, MacroStepKind } from '../protocol'
import { HTTP_ORIGIN } from '../serverConfig'

interface CaptureCropResult {
  imagePath: string
  previewPngBase64: string
}

interface Props {
  steps: MacroStep[]
  onChange: (steps: MacroStep[]) => void
  captureCrop: (roi: [number, number, number, number], name: string) => Promise<CaptureCropResult>
}

const KIND_LABELS: Record<MacroStepKind, string> = {
  click: 'Click',
  double_click: 'Double-click',
  wait_for: 'Wait for image',
  key: 'Press key',
  type: 'Type text',
}

const NEEDS_TARGET: MacroStepKind[] = ['click', 'double_click', 'wait_for']

function thumbnailUrl(target: string) {
  const filename = target.split('/').pop()
  return `${HTTP_ORIGIN}/targets/${filename}`
}

function emptyStep(): MacroStep {
  return { kind: 'click', threshold: 0.85, delayBeforeMs: 0, timeoutMs: 5000, retryCount: 0, onTimeout: 'abort' }
}

export function MacroStepEditor({ steps, onChange, captureCrop }: Props) {
  const [pickingIndex, setPickingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasPickerBridge = typeof window !== 'undefined' && !!window.pixelpulse

  function updateStep(index: number, patch: Partial<MacroStep>) {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)))
  }

  function addStep() {
    onChange([...steps, emptyStep()])
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index))
  }

  function moveStep(from: number, to: number) {
    if (to < 0 || to >= steps.length) return
    const next = [...steps]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  async function handlePickForStep(index: number) {
    if (!window.pixelpulse) return
    setPickingIndex(index)
    setError(null)
    try {
      const region = await window.pixelpulse.pickRegion()
      if (!region) return
      const roi: [number, number, number, number] = [region.left, region.top, region.width, region.height]
      const result = await captureCrop(roi, `macro-step-${index + 1}`)
      updateStep(index, { target: result.imagePath, roi })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPickingIndex(null)
    }
  }

  return (
    <div className="macro-editor">
      {!hasPickerBridge && (
        <div className="notice">Target picking needs the desktop app (not available in a plain browser tab).</div>
      )}
      {error && <div className="notice notice--danger">{error}</div>}

      {steps.length === 0 && <p className="muted">No steps yet. Add one below.</p>}

      <ol className="macro-step-list">
        {steps.map((step, index) => (
          <li key={index} className="macro-step">
            <div className="macro-step__row">
              <span className="macro-step__index">{index + 1}</span>
              <select value={step.kind} onChange={(e) => updateStep(index, { kind: e.target.value as MacroStepKind })}>
                {(Object.entries(KIND_LABELS) as [MacroStepKind, string][]).map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="macro-step__move">
                <button type="button" className="button button--ghost" disabled={index === 0} onClick={() => moveStep(index, index - 1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={index === steps.length - 1}
                  onClick={() => moveStep(index, index + 1)}
                >
                  ↓
                </button>
              </div>
              <button type="button" className="button button--ghost" onClick={() => removeStep(index)}>
                Delete
              </button>
            </div>

            {NEEDS_TARGET.includes(step.kind) && (
              <div className="macro-step__row">
                <button type="button" className="button" disabled={!hasPickerBridge || pickingIndex !== null} onClick={() => handlePickForStep(index)}>
                  {pickingIndex === index ? 'Picking…' : step.target ? 'Re-pick target' : 'Select Region on Screen'}
                </button>
                {step.target && <img className="macro-step__thumb" src={thumbnailUrl(step.target)} alt="" />}
              </div>
            )}

            {step.kind === 'key' && (
              <label className="field">
                <span>Key (e.g. "enter", "esc")</span>
                <input type="text" value={step.key ?? ''} onChange={(e) => updateStep(index, { key: e.target.value })} />
              </label>
            )}

            {step.kind === 'type' && (
              <label className="field">
                <span>Text to type</span>
                <input type="text" value={step.text ?? ''} onChange={(e) => updateStep(index, { text: e.target.value })} />
              </label>
            )}

            <div className="macro-step__row macro-step__row--timing">
              <label className="field field--inline">
                <span>Delay before (ms)</span>
                <input
                  type="number"
                  min={0}
                  value={step.delayBeforeMs ?? 0}
                  onChange={(e) => updateStep(index, { delayBeforeMs: Number(e.target.value) })}
                />
              </label>
              {NEEDS_TARGET.includes(step.kind) && (
                <>
                  <label className="field field--inline">
                    <span>Timeout (ms)</span>
                    <input
                      type="number"
                      min={100}
                      value={step.timeoutMs ?? 5000}
                      onChange={(e) => updateStep(index, { timeoutMs: Number(e.target.value) })}
                    />
                  </label>
                  <label className="field field--inline">
                    <span>Retries</span>
                    <input
                      type="number"
                      min={0}
                      value={step.retryCount ?? 0}
                      onChange={(e) => updateStep(index, { retryCount: Number(e.target.value) })}
                    />
                  </label>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>

      <button type="button" className="button button--ghost" onClick={addStep}>
        + Add Step
      </button>
    </div>
  )
}
