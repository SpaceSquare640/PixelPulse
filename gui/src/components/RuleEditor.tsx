import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { ActionKind, MacroStep, RuleConfig, TriggerConfig } from '../protocol'
import { MacroStepEditor } from './MacroStepEditor'

interface CaptureCropResult {
  imagePath: string
  previewPngBase64: string
}

interface CapturePixelResult {
  targetRgb: [number, number, number]
}

interface ImportImageResult {
  imagePath: string
  previewPngBase64: string
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
  importImage: (path: string, name: string) => Promise<ImportImageResult>
  previewTrigger: (trigger: TriggerConfig) => Promise<PreviewResult>
}

const STEP_KEYS = ['stepTrigger', 'stepAction', 'stepSafety'] as const

export function RuleEditor({ existingNames, onClose, onSave, captureCrop, capturePixel, importImage, previewTrigger }: Props) {
  const { t } = useLanguage()
  const [step, setStep] = useState(0)

  const [name, setName] = useState('')
  const [triggerKind, setTriggerKind] = useState<'template' | 'pixel'>('template')
  const [imageSource, setImageSource] = useState<'crop' | 'file'>('crop')
  const [roi, setRoi] = useState<[number, number, number, number] | null>(null)
  const [wholeScreen, setWholeScreen] = useState(false)
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
  const [macroSteps, setMacroSteps] = useState<MacroStep[]>([])

  const [cooldownMs, setCooldownMs] = useState(1000)
  const [maxTriggers, setMaxTriggers] = useState<number | ''>('')
  const [oncePerAppearance, setOncePerAppearance] = useState(false)
  const [dryRun, setDryRun] = useState(true)

  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const hasPickerBridge = typeof window !== 'undefined' && !!window.pixelpulse

  function buildTrigger(): TriggerConfig | null {
    if (triggerKind === 'template') {
      if (!image) return null
      // An uploaded file has no associated screen region, so it always
      // scans the whole screen; a screen-cropped region can optionally do
      // the same via the "whole screen" checkbox.
      const scanWholeScreen = imageSource === 'file' || wholeScreen
      return { kind: 'template', roi: scanWholeScreen ? null : roi, image, threshold }
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

  async function handlePickImageFile() {
    if (!window.pixelpulse) return
    setPicking(true)
    setCaptureError(null)
    try {
      const path = await window.pixelpulse.pickImageFile()
      if (!path) return
      const result = await importImage(path, name || 'target')
      setImage(result.imagePath)
      setPreviewImage(result.previewPngBase64)
      // An uploaded file isn't tied to any particular screen region.
      setRoi(null)
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
        ...(actionKind === 'macro' ? { steps: macroSteps } : {}),
      },
      cooldownMs,
      maxTriggers: maxTriggers === '' ? null : Number(maxTriggers),
      oncePerAppearance,
      dryRun,
    }
    onSave(rule)
  }

  const step1Complete = triggerKind === 'template' ? !!image : !!(roi && pixelPoint && targetRgb)
  const nameIsValid = name.trim().length > 0 && !existingNames.includes(name.trim())
  const macroStepsNeedingTarget = ['click', 'double_click', 'wait_for']
  const macroComplete =
    actionKind !== 'macro' ||
    (macroSteps.length > 0 && macroSteps.every((s) => !macroStepsNeedingTarget.includes(s.kind) || !!s.target))
  const canSave = step1Complete && nameIsValid && macroComplete

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{t('ruleEditor.title')}</h2>
          <div className="stepper">
            {STEP_KEYS.map((key, i) => (
              <span key={key} className={`stepper__item ${i === step ? 'stepper__item--active' : ''}`}>
                {i + 1}. {t(`ruleEditor.${key}`)}
              </span>
            ))}
          </div>
        </div>

        <div className="modal__body">
          {!hasPickerBridge && (
            <div className="notice">
              {t('ruleEditor.pickerBridgeNotice')}
            </div>
          )}
          {captureError && <div className="notice notice--danger">{captureError}</div>}

          {step === 0 && (
            <div className="form-stack">
              <label className="field">
                <span>{t('ruleEditor.triggerTypeLabel')}</span>
                <div className="segmented">
                  <button
                    type="button"
                    className={triggerKind === 'template' ? 'segmented__option segmented__option--active' : 'segmented__option'}
                    onClick={() => setTriggerKind('template')}
                  >
                    {t('ruleEditor.triggerTemplate')}
                  </button>
                  <button
                    type="button"
                    className={triggerKind === 'pixel' ? 'segmented__option segmented__option--active' : 'segmented__option'}
                    onClick={() => setTriggerKind('pixel')}
                  >
                    {t('ruleEditor.triggerPixel')}
                  </button>
                </div>
              </label>

              {triggerKind === 'template' ? (
                <>
                  <label className="field">
                    <span>{t('ruleEditor.imageSourceLabel')}</span>
                    <div className="segmented">
                      <button
                        type="button"
                        className={imageSource === 'crop' ? 'segmented__option segmented__option--active' : 'segmented__option'}
                        onClick={() => {
                          setImageSource('crop')
                          setImage(null)
                          setPreviewImage(null)
                          setRoi(null)
                          setPreviewResult(null)
                        }}
                      >
                        {t('ruleEditor.imageSourceCrop')}
                      </button>
                      <button
                        type="button"
                        className={imageSource === 'file' ? 'segmented__option segmented__option--active' : 'segmented__option'}
                        onClick={() => {
                          setImageSource('file')
                          setImage(null)
                          setPreviewImage(null)
                          setRoi(null)
                          setPreviewResult(null)
                        }}
                      >
                        {t('ruleEditor.imageSourceFile')}
                      </button>
                    </div>
                  </label>

                  {imageSource === 'crop' ? (
                    <button type="button" className="button" disabled={!hasPickerBridge || picking} onClick={handlePickRegion}>
                      {picking ? t('ruleEditor.picking') : t('ruleEditor.selectRegion')}
                    </button>
                  ) : (
                    <button type="button" className="button" disabled={!hasPickerBridge || picking} onClick={handlePickImageFile}>
                      {picking ? t('ruleEditor.picking') : t('ruleEditor.browseFile')}
                    </button>
                  )}

                  {previewImage && (
                    <img className="capture-preview" src={`data:image/png;base64,${previewImage}`} alt={t('ruleEditor.capturedTargetAlt')} />
                  )}

                  {imageSource === 'crop' ? (
                    <label className="field field--checkbox">
                      <input type="checkbox" checked={wholeScreen} onChange={(e) => setWholeScreen(e.target.checked)} />
                      <span>{t('ruleEditor.wholeScreenLabel')}</span>
                    </label>
                  ) : (
                    <p className="muted">{t('ruleEditor.wholeScreenForcedNote')}</p>
                  )}

                  <label className="field">
                    <span>{t('ruleEditor.matchThreshold', { value: threshold.toFixed(2) })}</span>
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
                    {picking ? t('ruleEditor.picking') : t('ruleEditor.pickPoint')}
                  </button>
                  {targetRgb && (
                    <div className="pixel-preview">
                      <span className="pixel-preview__swatch" style={{ background: `rgb(${targetRgb.join(',')})` }} />
                      <span>
                        {t('ruleEditor.pixelSwatchAt', { rgb: targetRgb.join(', '), x: pixelPoint?.x ?? '', y: pixelPoint?.y ?? '' })}
                      </span>
                    </div>
                  )}
                  <label className="field">
                    <span>{t('ruleEditor.colourTolerance', { value: tolerance })}</span>
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
                    {previewing ? t('ruleEditor.testing') : t('ruleEditor.testMatch')}
                  </button>
                  {previewResult && (
                    <span className={previewResult.matched ? 'test-match__result test-match__result--hit' : 'test-match__result'}>
                      {previewResult.matched
                        ? `${t('ruleEditor.matchedAt', { x: previewResult.x ?? '', y: previewResult.y ?? '' })}${
                            previewResult.confidence != null
                              ? t('ruleEditor.confidenceSuffix', { value: (previewResult.confidence * 100).toFixed(1) })
                              : ''
                          }`
                        : t('ruleEditor.noMatch')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="form-stack">
              <label className="field">
                <span>{t('ruleEditor.actionLabel')}</span>
                <select value={actionKind} onChange={(e) => setActionKind(e.target.value as ActionKind)}>
                  <option value="click">{t('ruleEditor.actionClick')}</option>
                  <option value="double_click">{t('ruleEditor.actionDoubleClick')}</option>
                  <option value="key">{t('ruleEditor.actionKey')}</option>
                  <option value="type">{t('ruleEditor.actionType')}</option>
                  <option value="macro">{t('ruleEditor.actionMacro')}</option>
                </select>
              </label>

              {(actionKind === 'click' || actionKind === 'double_click') && (
                <label className="field">
                  <span>{t('ruleEditor.mouseButton')}</span>
                  <select value={button} onChange={(e) => setButton(e.target.value)}>
                    <option value="left">{t('ruleEditor.buttonLeft')}</option>
                    <option value="right">{t('ruleEditor.buttonRight')}</option>
                    <option value="middle">{t('ruleEditor.buttonMiddle')}</option>
                  </select>
                </label>
              )}

              {actionKind === 'key' && (
                <label className="field">
                  <span>{t('ruleEditor.keyLabel')}</span>
                  <input type="text" value={key} onChange={(e) => setKey(e.target.value)} />
                </label>
              )}

              {actionKind === 'type' && (
                <label className="field">
                  <span>{t('ruleEditor.textToType')}</span>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
                </label>
              )}

              {actionKind === 'macro' && (
                <MacroStepEditor steps={macroSteps} onChange={setMacroSteps} captureCrop={captureCrop} />
              )}
            </div>
          )}

          {step === 2 && (
            <div className="form-stack">
              <label className="field">
                <span>{t('ruleEditor.ruleName')}</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('ruleEditor.ruleNamePlaceholder')}
                />
                {name.trim() && !nameIsValid && <span className="field__error">{t('ruleEditor.duplicateNameError')}</span>}
              </label>
              <label className="field field--checkbox">
                <input
                  type="checkbox"
                  checked={oncePerAppearance}
                  onChange={(e) => setOncePerAppearance(e.target.checked)}
                />
                <span>{t('ruleEditor.oncePerAppearanceLabel')}</span>
              </label>
              {!oncePerAppearance && (
                <label className="field">
                  <span>{t('ruleEditor.cooldown')}</span>
                  <input type="number" min={0} value={cooldownMs} onChange={(e) => setCooldownMs(Number(e.target.value))} />
                </label>
              )}
              <label className="field">
                <span>{t('ruleEditor.maxTriggers')}</span>
                <input
                  type="number"
                  min={1}
                  value={maxTriggers}
                  onChange={(e) => setMaxTriggers(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label className="field field--checkbox">
                <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                <span>{t('ruleEditor.dryRunLabel')}</span>
              </label>
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <div className="modal__footer-spacer" />
          {step > 0 && (
            <button type="button" className="button" onClick={() => setStep(step - 1)}>
              {t('common.back')}
            </button>
          )}
          {step < STEP_KEYS.length - 1 && (
            <button type="button" className="button button--primary" disabled={step === 0 && !step1Complete} onClick={() => setStep(step + 1)}>
              {t('common.next')}
            </button>
          )}
          {step === STEP_KEYS.length - 1 && (
            <button type="button" className="button button--primary" disabled={!canSave} onClick={handleSave}>
              {t('ruleEditor.saveRule')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
