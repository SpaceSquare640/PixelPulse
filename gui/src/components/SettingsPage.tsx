import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import languageIcon from '../assets/language-icon.png'
import { useLanguage } from '../i18n/LanguageContext'

interface Props {
  onOpenHelp: () => void
}

// The source PNG is solid black on transparent -- used as a mask so it
// always renders in the current text colour (muted on the inactive segment,
// dark-on-accent when active) instead of baking in a fixed colour via
// filter() hacks that never quite match the theme.
// 來源 PNG 是純黑色、透明背景 —— 用 mask 讓它永遠套用當下的文字顏色（未選取
// 時是灰階、選中時是強調色底上的深色文字色），而不是用 filter() 硬湊一個
// 永遠對不準主題色的顏色。
const iconMaskStyle: CSSProperties = {
  backgroundColor: 'currentColor',
  WebkitMaskImage: `url(${languageIcon})`,
  maskImage: `url(${languageIcon})`,
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
}

export function SettingsPage({ onOpenHelp }: Props) {
  const { lang, setLang, t } = useLanguage()
  const [version, setVersion] = useState<string | null>(null)
  const [lastPicked, setLastPicked] = useState<{ rgb: [number, number, number]; x: number; y: number }[] | null>(null)
  const hasPickerBridge = typeof window !== 'undefined' && !!window.pixelpulse

  useEffect(() => {
    window.pixelpulse?.getAppVersion().then(setVersion)
  }, [])

  async function handleOpenMagnifier() {
    if (!window.pixelpulse) return
    const result = await window.pixelpulse.pickColours()
    setLastPicked(result)
  }

  return (
    <div className="settings-page">
      <section className="panel">
        <h2>{t('settings.languageTitle')}</h2>
        <p className="muted">{t('settings.languageDescription')}</p>
        <div className="segmented segmented--icon">
          <button
            type="button"
            className={lang === 'zh' ? 'segmented__option segmented__option--active' : 'segmented__option'}
            onClick={() => setLang('zh')}
          >
            <span className="segmented__icon" style={iconMaskStyle} />
            中文
          </button>
          <button
            type="button"
            className={lang === 'en' ? 'segmented__option segmented__option--active' : 'segmented__option'}
            onClick={() => setLang('en')}
          >
            <span className="segmented__icon" style={iconMaskStyle} />
            English
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>{t('settings.toolsTitle')}</h2>
        <p className="muted">{t('settings.toolsDescription')}</p>
        <button type="button" className="button" disabled={!hasPickerBridge} onClick={handleOpenMagnifier}>
          {t('settings.openMagnifier')}
        </button>
        {lastPicked && lastPicked.length > 0 && (
          <div className="colour-pattern-swatches">
            {lastPicked.map((c, i) => (
              <span
                key={i}
                className="colour-pattern-swatches__item"
                style={{ background: `rgb(${c.rgb.join(',')})` }}
                title={`rgb(${c.rgb.join(', ')}) @ (${c.x}, ${c.y})`}
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>{t('settings.aboutTitle')}</h2>
        <p className="muted">{version ? t('settings.version', { version }) : t('settings.versionUnknown')}</p>
        <button type="button" className="button" onClick={onOpenHelp}>
          {t('statusBar.help')}
        </button>
      </section>
    </div>
  )
}
