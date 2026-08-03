import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { ActionKind, ColourPoint, MacroStep, RuleConfig, TriggerConfig } from '../protocol'
import { HTTP_ORIGIN } from '../serverConfig'
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

interface DetectColoursResult {
  colours: ColourPoint[]
}

interface PreviewResult {
  matched: boolean
  x?: number | null
  y?: number | null
  confidence?: number | null
}

interface Props {
  existingNames: string[]
  // When set, the editor pre-fills every field from this rule and Save
  // updates it in place instead of creating a new one.
  // 有設定時，編輯器會用這條規則的既有值預先帶入每個欄位，存檔時會原地更新
  // 這條規則，而不是新增一條。
  existingRule?: RuleConfig | null
  onClose: () => void
  onSave: (rule: RuleConfig) => void
  onUpdate?: (originalName: string, rule: RuleConfig) => void
  captureCrop: (roi: [number, number, number, number], name: string) => Promise<CaptureCropResult>
  capturePixel: (x: number, y: number) => Promise<CapturePixelResult>
  importImage: (path: string, name: string) => Promise<ImportImageResult>
  detectColours: (imagePath: string, maxColours?: number) => Promise<DetectColoursResult>
  previewTrigger: (trigger: TriggerConfig) => Promise<PreviewResult>
}

const STEP_KEYS = ['stepTrigger', 'stepAction', 'stepSafety'] as const

function imageUrlFor(path: string): string {
  const filename = path.split('/').pop()
  return `${HTTP_ORIGIN}/targets/${filename}`
}

export function RuleEditor({
  existingNames,
  existingRule,
  onClose,
  onSave,
  onUpdate,
  captureCrop,
  capturePixel,
  importImage,
  detectColours,
  previewTrigger,
}: Props) {
  const { t } = useLanguage()
  const [step, setStep] = useState(0)

  const [name, setName] = useState(existingRule?.name ?? '')
  const [triggerKind, setTriggerKind] = useState<'template' | 'pixel' | 'colour_pattern'>(
    existingRule?.trigger.kind ?? 'template',
  )
  const [imageSource, setImageSource] = useState<'crop' | 'file'>('crop')
  const [roi, setRoi] = useState<[number, number, number, number] | null>(existingRule?.trigger.roi ?? null)
  // Defaults to true: a template match should find its target wherever it
  // appears, not just inside the exact box it happened to be captured from
  // -- a fixed region silently stops matching the instant the target moves.
  // Power users who specifically want a smaller, faster/less-false-positive
  // scan area can still uncheck this.
  // 預設為 true：樣板比對應該要能在目標出現的任何地方找到它，而不只是限定
  // 在當初擷取時剛好框選的那個區域 —— 目標一旦移動位置，固定區域就會立刻
  // 偵測不到。想要縮小掃描範圍換取速度、減少誤判的進階使用者，仍然可以自己
  // 取消勾選。
  const [wholeScreen, setWholeScreen] = useState(
    existingRule ? existingRule.trigger.roi == null : true,
  )
  const [image, setImage] = useState<string | null>(
    existingRule?.trigger.kind === 'template' ? (existingRule.trigger.image ?? null) : null,
  )
  const [previewSrc, setPreviewSrc] = useState<string | null>(
    existingRule?.trigger.kind === 'template' && existingRule.trigger.image
      ? imageUrlFor(existingRule.trigger.image)
      : null,
  )
  const [threshold, setThreshold] = useState(existingRule?.trigger.threshold ?? 0.85)
  const [pixelPoint, setPixelPoint] = useState<{ x: number; y: number } | null>(
    existingRule?.trigger.kind === 'pixel' && existingRule.trigger.roi
      ? { x: existingRule.trigger.roi[0] + (existingRule.trigger.pixelX ?? 0), y: existingRule.trigger.roi[1] + (existingRule.trigger.pixelY ?? 0) }
      : null,
  )
  const [targetRgb, setTargetRgb] = useState<[number, number, number] | null>(
    existingRule?.trigger.kind === 'pixel' ? (existingRule.trigger.targetRgb ?? null) : null,
  )
  const [tolerance, setTolerance] = useState(existingRule?.trigger.tolerance ?? 10)
  const [colours, setColours] = useState<ColourPoint[] | null>(
    existingRule?.trigger.kind === 'colour_pattern' ? (existingRule.trigger.colours ?? null) : null,
  )
  const [minMatches, setMinMatches] = useState(
    existingRule?.trigger.kind === 'colour_pattern' ? (existingRule.trigger.minMatches ?? 2) : 2,
  )
  const [clusterRadius, setClusterRadius] = useState(
    existingRule?.trigger.kind === 'colour_pattern' ? (existingRule.trigger.clusterRadius ?? 15) : 15,
  )
  const [detectingColours, setDetectingColours] = useState(false)
  const [picking, setPicking] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)

  const [actionKind, setActionKind] = useState<ActionKind>(existingRule?.action.kind ?? 'click')
  const [button, setButton] = useState(existingRule?.action.button ?? 'left')
  const [key, setKey] = useState(existingRule?.action.key ?? '')
  const [text, setText] = useState(existingRule?.action.text ?? '')
  const [macroSteps, setMacroSteps] = useState<MacroStep[]>(existingRule?.action.steps ?? [])

  const [cooldownMs, setCooldownMs] = useState(existingRule?.cooldownMs ?? 1000)
  const [maxTriggers, setMaxTriggers] = useState<number | ''>(existingRule?.maxTriggers ?? '')
  const [oncePerAppearance, setOncePerAppearance] = useState(existingRule?.oncePerAppearance ?? false)
  const [dryRun, setDryRun] = useState(existingRule?.dryRun ?? true)

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
    if (triggerKind === 'pixel') {
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
    // colour_pattern ("像素圖"): always scans the whole screen -- the whole
    // point of this trigger is tolerating a target that moves *and* rotates,
    // so a fixed region would defeat its purpose.
    // 像素圖：一律掃描整個螢幕——這個觸發條件的重點就是容忍目標會移動又旋轉，
    // 固定範圍會違背它存在的意義。
    if (!colours || colours.length === 0) return null
    return {
      kind: 'colour_pattern',
      roi: null,
      colours,
      tolerance,
      minMatches: Math.min(minMatches, colours.length),
      clusterRadius,
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
      setPreviewSrc(`data:image/png;base64,${result.previewPngBase64}`)
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
      setPreviewSrc(`data:image/png;base64,${result.previewPngBase64}`)
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

  async function handlePickColours() {
    if (!window.pixelpulse) return
    setPicking(true)
    setCaptureError(null)
    try {
      const picked = await window.pixelpulse.pickColours()
      if (!picked || picked.length === 0) return
      const cx = picked.reduce((sum, c) => sum + c.x, 0) / picked.length
      const cy = picked.reduce((sum, c) => sum + c.y, 0) / picked.length
      setColours(picked.map((c) => ({ rgb: c.rgb, offsetX: Math.round(c.x - cx), offsetY: Math.round(c.y - cy) })))
      setPreviewResult(null)
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : String(err))
    } finally {
      setPicking(false)
    }
  }

  async function handleAutoDetectColours() {
    if (!window.pixelpulse) return
    setDetectingColours(true)
    setCaptureError(null)
    try {
      const region = await window.pixelpulse.pickRegion()
      if (!region) return
      const roiTuple: [number, number, number, number] = [region.left, region.top, region.width, region.height]
      const captured = await captureCrop(roiTuple, name || 'colour-source')
      const result = await detectColours(captured.imagePath, 5)
      setColours(result.colours)
      setPreviewResult(null)
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : String(err))
    } finally {
      setDetectingColours(false)
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
    if (existingRule && onUpdate) {
      onUpdate(existingRule.name, rule)
    } else {
      onSave(rule)
    }
  }

  const step1Complete =
    triggerKind === 'template'
      ? !!image
      : triggerKind === 'pixel'
        ? !!(roi && pixelPoint && targetRgb)
        : !!colours && colours.length > 0
  const trimmedName = name.trim()
  const nameIsValid =
    trimmedName.length > 0 && (trimmedName === existingRule?.name || !existingNames.includes(trimmedName))
  const macroStepsNeedingTarget = ['click', 'double_click', 'wait_for']
  const macroComplete =
    actionKind !== 'macro' ||
    (macroSteps.length > 0 && macroSteps.every((s) => !macroStepsNeedingTarget.includes(s.kind) || !!s.target))
  const canSave = step1Complete && nameIsValid && macroComplete

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{existingRule ? t('ruleEditor.editTitle') : t('ruleEditor.title')}</h2>
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
                  <button
                    type="button"
                    className={
                      triggerKind === 'colour_pattern' ? 'segmented__option segmented__option--active' : 'segmented__option'
                    }
                    onClick={() => setTriggerKind('colour_pattern')}
                  >
                    {t('ruleEditor.triggerColourPattern')}
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
                          setPreviewSrc(null)
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
                          setPreviewSrc(null)
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

                  {previewSrc && (
                    <img className="capture-preview" src={previewSrc} alt={t('ruleEditor.capturedTargetAlt')} />
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
              ) : triggerKind === 'pixel' ? (
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
              ) : (
                <>
                  <p className="muted">{t('ruleEditor.colourPatternNote')}</p>
                  <div className="button-row">
                    <button
                      type="button"
                      className="button"
                      disabled={!hasPickerBridge || detectingColours}
                      onClick={handleAutoDetectColours}
                    >
                      {detectingColours ? t('ruleEditor.picking') : t('ruleEditor.autoDetectColours')}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={!hasPickerBridge || picking}
                      onClick={handlePickColours}
                    >
                      {picking ? t('ruleEditor.picking') : t('ruleEditor.pickColoursWithMagnifier')}
                    </button>
                  </div>

                  {colours && colours.length > 0 && (
                    <div className="colour-pattern-swatches">
                      {colours.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          className="colour-pattern-swatches__item"
                          style={{ background: `rgb(${c.rgb.join(',')})` }}
                          title={t('ruleEditor.removeColour')}
                          onClick={() => setColours(colours.filter((_, idx) => idx !== i))}
                        />
                      ))}
                    </div>
                  )}

                  {colours && colours.length > 0 && (
                    <label className="field">
                      <span>{t('ruleEditor.minMatches', { value: minMatches, total: colours.length })}</span>
                      <input
                        type="range"
                        min={1}
                        max={colours.length}
                        step={1}
                        value={Math.min(minMatches, colours.length)}
                        onChange={(e) => setMinMatches(Number(e.target.value))}
                      />
                    </label>
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

                  <label className="field">
                    <span>{t('ruleEditor.clusterRadius', { value: clusterRadius })}</span>
                    <input
                      type="range"
                      min={5}
                      max={60}
                      step={1}
                      value={clusterRadius}
                      onChange={(e) => setClusterRadius(Number(e.target.value))}
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
