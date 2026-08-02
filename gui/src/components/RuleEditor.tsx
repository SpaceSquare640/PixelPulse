import { useState } from 'react'
import type { ActionKind, RuleConfig, TriggerConfig } from '../protocol'

interface CaptureCropResult {
  imagePath: string
  previewPngBase64: string
}

interface CapturePixelResult {
  targetRgb: [number, number, number]
}

interface PreviewResult {
  matched: boolean
  x?: number | null
  y?: number | null
  confidence?: number | null
}

interface Props {
  existingNames: string[]
  onClose: () => void
  onSave: (rule: RuleConfig) => void
  captureCrop: (roi: [number, number, number, number], name: string) => Promise<CaptureCropResult>
  capturePixel: (x: number, y: number) => Promise<CapturePixelResult>
  previewTrigger: (trigger: TriggerConfig) => Promise<PreviewResult>
}

const STEPS = ['Trigger', 'Action', 'Safety'] as const

export function RuleEditor({ existingNames, onClose, onSave, captureCrop, capturePixel, previewTrigger }: Props) {
  const [step, setStep] = useState(0)

  const [name, setName] = useState('')
  const [triggerKind, setTriggerKind] = useState<'template' | 'pixel'>('template')
  const [roi, setRoi] = useState<[number, number, number, number] | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(0.85)
  const [pixelPoint, setPixelPoint] = useState<{ x: number; y: number } | null>(null)
  const [targetRgb, setTargetRgb] = useState<[number, number, number] | null>(null)
  const [tolerance, setTolerance] = useState(10)
  const [picking, setPicking] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)

  const [actionKind, setActionKind] = useState<ActionKind>('click')
  const [button, setButton] = useState('left')
  const [key, setKey] = useState('')
  const [text, setText] = useState('')

  const [cooldownMs, setCooldownMs] = useState(1000)
  const [maxTriggers, setMaxTriggers] = useState<number | ''>('')
  const [dryRun, setDryRun] = useState(true)

  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const hasPickerBridge = typeof window !== 'undefined' && !!window.pixelpulse

  function buildTrigger(): TriggerConfig | null {
    if (triggerKind === 'template') {
      if (!roi || !image) return null
      return { kind: 'template', roi, image, threshold }
    }
    if (!roi || !pixelPoint || !targetRgb) return null
    return {
      kind: 'pixel',
      roi,
      pixelX: pixelPoint.x - roi[0],
      pixelY: pixelPoint.y - roi[1],
      targetRgb,
      tolerance,
    }
  }

  async function handlePickRegion() {
    if (!window.pixelpulse) return
    setPicking(true)
    setCaptureError(null)
    try {
      const region = await window.pixelpulse.pickRegion()
      if (!region) return
      const roiTuple: [number, number, number, number] = [region.left, region.top, region.width, region.height]
      const result = await captureCrop(roiTuple, name || 'target')
      setRoi(roiTuple)
      setImage(result.imagePath)
      setPreviewImage(result.previewPngBase64)
      setPreviewResult(null)
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : String(err))
    } finally {
      setPicking(false)
    }
  }

  async function handlePickPoint() {
    if (!window.pixelpulse) return
    setPicking(true)
    setCaptureError(null)
    try {
      const point = await window.pixelpulse.pickPoint()
      if (!point) return
      const result = await capturePixel(point.x, point.y)
      setPixelPoint(point)
      setTargetRgb(result.targetRgb)
      // Auto-derive a small ROI around the point -- the pixel trigger still
      // needs *some* region to re-capture each scan.
      setRoi([point.x - 10, point.y - 10, 20, 20])
      setPreviewResult(null)
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : String(err))
    } finally {
      setPicking(false)
    }
  }

  async function handleTestMatch() {
    const trigger = buildTrigger()
    if (!trigger) return
    setPreviewing(true)
    setPreviewResult(null)
    setCaptureError(null)
    try {
      setPreviewResult(await previewTrigger(trigger))
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : String(err))
    } finally {
      setPreviewing(false)
    }
  }

  function handleSave() {
    const trigger = buildTrigger()
    if (!trigger || !canSave) return
    const rule: RuleConfig = {
      name: name.trim(),
      trigger,
      action: {
        kind: actionKind,
        ...(actionKind === 'click' || actionKind === 'double_click' ? { button } : {}),
        ...(actionKind === 'key' ? { key } : {}),
        ...(actionKind === 'type' ? { text } : {}),
      },
      cooldownMs,
      maxTriggers: maxTriggers === '' ? null : Number(maxTriggers),
      dryRun,
    }
    onSave(rule)
  }

  const step1Complete =
    triggerKind === 'template' ? !!(roi && image) : !!(roi && pixelPoint && targetRgb)
  const nameIsValid = name.trim().length > 0 && !existingNames.includes(name.trim())
  const canSave = step1Complete && nameIsValid

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>New Rule</h2>
          <div className="stepper">
            {STEPS.map((label, i) => (
              <span key={label} className={`stepper__item ${i === step ? 'stepper__item--active' : ''}`}>
                {i + 1}. {label}
              </span>
            ))}
          </div>
        </div>

        <div className="modal__body">
          {!hasPickerBridge && (
            <div className="notice">
              Region/point picking needs the desktop app (not available in a plain browser tab).
            </div>
          )}
          {captureError && <div className="notice notice--danger">{captureError}</div>}

          {step === 0 && (
            <div className="form-stack">
              <label className="field">
                <span>Trigger type</span>
                <div className="segmented">
                  <button
                    type="button"
                    className={triggerKind === 'template' ? 'segmented__option segmented__option--active' : 'segmented__option'}
                    onClick={() => setTriggerKind('template')}
                  >
                    Image (template)
                  </button>
                  <button
                    type="button"
                    className={triggerKind === 'pixel' ? 'segmented__option segmented__option--active' : 'segmented__option'}
                    onClick={() => setTriggerKind('pixel')}
                  >
                    Pixel colour
                  </button>
                </div>
              </label>

              {triggerKind === 'template' ? (
                <>
                  <button type="button" className="button" disabled={!hasPickerBridge || picking} onClick={handlePickRegion}>
                    {picking ? 'Picking…' : 'Select Region on Screen'}
                  </button>
                  {previewImage && (
                    <img className="capture-preview" src={`data:image/png;base64,${previewImage}`} alt="Captured target" />
                  )}
                  <label className="field">
                    <span>Match threshold: {threshold.toFixed(2)}</span>
                    <input
                      type="range"
                      min={0.5}
                      max={1}
                      step={0.01}
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                    />
                  </label>
                </>
              ) : (
                <>
                  <button type="button" className="button" disabled={!hasPickerBridge || picking} onClick={handlePickPoint}>
                    {picking ? 'Picking…' : 'Pick a Point on Screen'}
                  </button>
                  {targetRgb && (
                    <div className="pixel-preview">
                      <span className="pixel-preview__swatch" style={{ background: `rgb(${targetRgb.join(',')})` }} />
                      <span>
                        rgb({targetRgb.join(', ')}) at ({pixelPoint?.x}, {pixelPoint?.y})
                      </span>
                    </div>
                  )}
                  <label className="field">
                    <span>Colour tolerance: {tolerance}</span>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                    />
                  </label>
                </>
              )}

              {step1Complete && (
                <div className="test-match">
                  <button type="button" className="button button--ghost" disabled={previewing} onClick={handleTestMatch}>
                    {previewing ? 'Testing…' : 'Test Match'}
                  </button>
                  {previewResult && (
                    <span className={previewResult.matched ? 'test-match__result test-match__result--hit' : 'test-match__result'}>
                      {previewResult.matched
                        ? `Matched at (${previewResult.x}, ${previewResult.y})${
                            previewResult.confidence != null ? ` — ${(previewResult.confidence * 100).toFixed(1)}%` : ''
                          }`
                        : 'No match found right now'}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="form-stack">
              <label className="field">
                <span>Action</span>
                <select value={actionKind} onChange={(e) => setActionKind(e.target.value as ActionKind)}>
                  <option value="click">Click</option>
                  <option value="double_click">Double-click</option>
                  <option value="key">Press key</option>
                  <option value="type">Type text</option>
                </select>
              </label>

              {(actionKind === 'click' || actionKind === 'double_click') && (
                <label className="field">
                  <span>Mouse button</span>
                  <select value={button} onChange={(e) => setButton(e.target.value)}>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                    <option value="middle">Middle</option>
                  </select>
                </label>
              )}

              {actionKind === 'key' && (
                <label className="field">
                  <span>Key (e.g. "enter", "esc")</span>
                  <input type="text" value={key} onChange={(e) => setKey(e.target.value)} />
                </label>
              )}

              {actionKind === 'type' && (
                <label className="field">
                  <span>Text to type</span>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
                </label>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="form-stack">
              <label className="field">
                <span>Rule name</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Click confirm button" />
                {name.trim() && !nameIsValid && <span className="field__error">A rule with this name already exists.</span>}
              </label>
              <label className="field">
                <span>Cooldown (ms)</span>
                <input type="number" min={0} value={cooldownMs} onChange={(e) => setCooldownMs(Number(e.target.value))} />
              </label>
              <label className="field">
                <span>Max triggers (optional)</span>
                <input
                  type="number"
                  min={1}
                  value={maxTriggers}
                  onChange={(e) => setMaxTriggers(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label className="field field--checkbox">
                <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                <span>Dry run (log matches, don't actually click/type yet)</span>
              </label>
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancel
          </button>
          <div className="modal__footer-spacer" />
          {step > 0 && (
            <button type="button" className="button" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button type="button" className="button button--primary" disabled={step === 0 && !step1Complete} onClick={() => setStep(step + 1)}>
              Next
            </button>
          )}
          {step === STEPS.length - 1 && (
            <button type="button" className="button button--primary" disabled={!canSave} onClick={handleSave}>
              Save Rule
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
