import { useEffect, useState } from 'react'

interface Props {
  mode: 'region' | 'point'
  originX: number
  originY: number
}

interface Point {
  x: number
  y: number
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
        <div className="picker-hint">Click a point to pick its colour — Esc to cancel</div>
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
      {!selection && <div className="picker-hint">Drag to select a region — Esc to cancel</div>}

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
