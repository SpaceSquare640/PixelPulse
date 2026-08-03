import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { WS_URL } from '../serverConfig'

interface Props {
  mode: 'region' | 'point'
  originX: number
  originY: number
}

interface Point {
  x: number
  y: number
}

interface PickedColour {
  rgb: [number, number, number]
  x: number
  y: number
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
}

// The standalone/RuleEditor-integrated pixel magnifier ("像素圖" colour
// picking tool): a full-desktop transparent overlay (like the point picker)
// that continuously shows the RGB value under the cursor as you move, and
// lets you click to add several colours to a list before finishing with
// Enter -- rather than the single-point picker's one-click-and-done flow.
//
// 像素放大鏡工具（給「像素圖」挑色用）：跟點選工具一樣是蓋住整個桌面的透明
// 疊層，但滑鼠移動時會持續顯示游標下的 RGB 值，並且可以多次點擊把好幾個
// 顏色加進清單，最後按 Enter 才算完成 —— 不像單點選色一次點擊就結束。
export function MagnifierOverlay({ originX, originY }: { originX: number; originY: number }) {
  const { t } = useLanguage()
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 })
  const [liveRgb, setLiveRgb] = useState<[number, number, number] | null>(null)
  const [picked, setPicked] = useState<PickedColour[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const lastRequestAtRef = useRef(0)

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'capture.pixel') {
        setLiveRgb(message.targetRgb)
      }
    }
    return () => ws.close()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        window.pixelpulse?.reportPickerResult(null)
      } else if (e.key === 'Enter') {
        window.pixelpulse?.reportPickerResult(picked)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [picked])

  function handleMouseMove(e: React.MouseEvent) {
    setCursor({ x: e.clientX, y: e.clientY })
    const now = performance.now()
    if (now - lastRequestAtRef.current < 60) return // throttle: ~16 requests/sec
    lastRequestAtRef.current = now
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'capture.pixel', x: originX + e.clientX, y: originY + e.clientY }))
    }
  }

  function handleClick() {
    if (!liveRgb) return
    setPicked((prev) => [...prev, { rgb: liveRgb, x: originX + cursor.x, y: originY + cursor.y }])
  }

  return (
    <div className="picker-overlay picker-overlay--magnify" onMouseMove={handleMouseMove} onClick={handleClick}>
      <div className="picker-hint">{t('picker.magnifyHint', { count: picked.length })}</div>
      {liveRgb && (
        <div
          className="magnifier-hud"
          style={{ left: cursor.x + 16, top: cursor.y + 16 }}
        >
          <span className="magnifier-hud__swatch" style={{ background: `rgb(${liveRgb.join(',')})` }} />
          <span className="magnifier-hud__label">
            {toHex(liveRgb)} · rgb({liveRgb.join(', ')})
          </span>
        </div>
      )}
      {picked.length > 0 && (
        <div className="magnifier-picked">
          {picked.map((c, i) => (
            <span key={i} className="magnifier-picked__swatch" style={{ background: `rgb(${c.rgb.join(',')})` }} />
          ))}
        </div>
      )}
    </div>
  )
}

// The window itself is transparent (see electron/main.js) and covers the
// whole virtual desktop, so wherever this component doesn't paint anything,
// the real desktop shows straight through. Four bars dim everything *except*
// the current selection, which is how the user sees what they're selecting
// without needing an actual screenshot image.
//
// 這個視窗本身是透明的（見 electron/main.js），涵蓋整個虛擬桌面，所以只要
// 這個元件沒有畫東西的地方，真實桌面就會直接透出來。用四條「遮罩」把目前
// 選取範圍以外的地方調暗，使用者不需要真的截圖也能看清楚自己選了什麼。
export function PickerOverlay({ mode, originX, originY }: Props) {
  const { t } = useLanguage()
  const [start, setStart] = useState<Point | null>(null)
  const [current, setCurrent] = useState<Point | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        window.pixelpulse?.reportPickerResult(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function toAbsolute(p: Point) {
    return { x: originX + p.x, y: originY + p.y }
  }

  function handlePointClick(e: React.MouseEvent) {
    const abs = toAbsolute({ x: e.clientX, y: e.clientY })
    window.pixelpulse?.reportPickerResult(abs)
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (mode !== 'region') return
    setStart({ x: e.clientX, y: e.clientY })
    setCurrent({ x: e.clientX, y: e.clientY })
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (mode !== 'region' || !start) return
    setCurrent({ x: e.clientX, y: e.clientY })
  }

  function handleMouseUp() {
    if (mode !== 'region' || !start || !current) return
    const left = Math.min(start.x, current.x)
    const top = Math.min(start.y, current.y)
    const width = Math.abs(current.x - start.x)
    const height = Math.abs(current.y - start.y)

    if (width < 4 || height < 4) {
      // Treat a near-zero drag as an accidental click, not a real selection.
      setStart(null)
      setCurrent(null)
      return
    }

    const abs = toAbsolute({ x: left, y: top })
    window.pixelpulse?.reportPickerResult({ left: abs.x, top: abs.y, width, height })
  }

  if (mode === 'point') {
    return (
      <div className="picker-overlay picker-overlay--point" onClick={handlePointClick}>
        <div className="picker-hint">{t('picker.clickToPickColour')}</div>
      </div>
    )
  }

  const selection =
    start && current
      ? {
          left: Math.min(start.x, current.x),
          top: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y),
        }
      : null

  return (
    <div
      className="picker-overlay picker-overlay--region"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {!selection && <div className="picker-hint">{t('picker.dragToSelectRegion')}</div>}

      {selection && (
        <>
          <div className="picker-mask" style={{ left: 0, top: 0, right: 0, height: selection.top }} />
          <div
            className="picker-mask"
            style={{ left: 0, top: selection.top + selection.height, right: 0, bottom: 0 }}
          />
          <div
            className="picker-mask"
            style={{ left: 0, top: selection.top, width: selection.left, height: selection.height }}
          />
          <div
            className="picker-mask"
            style={{
              left: selection.left + selection.width,
              top: selection.top,
              right: 0,
              height: selection.height,
            }}
          />
          <div
            className="picker-selection"
            style={{ left: selection.left, top: selection.top, width: selection.width, height: selection.height }}
          >
            <span className="picker-selection__size">
              {selection.width} × {selection.height}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
