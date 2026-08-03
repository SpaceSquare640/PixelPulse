import type { ComponentType } from 'react'
import { useLanguage } from '../i18n/LanguageContext'

export type Page = 'rules' | 'activity' | 'settings'

interface Props {
  page: Page
  onNavigate: (page: Page) => void
}

// Small stroke-based icon set, drawn to match in visual weight (1.6px
// stroke, 20x20) rather than pulled from a mismatched icon font -- keeps
// the sidebar's three icons feeling like one consistent set.
// 一組筆畫粗細一致（1.6px、20x20）手繪的簡單圖示，而不是從風格不搭的圖示
// 字型裡挑幾個湊數 -- 讓側邊欄的三個圖示看起來像同一套設計。
function RulesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 8h7M6.5 12h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.5 10.5h3l2-5 3 9 2-7 1.5 3h3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="2.8" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 3.5v1.6M10 14.9v1.6M16.5 10h-1.6M5.1 10H3.5M14.6 5.4l-1.1 1.1M6.5 13.5l-1.1 1.1M14.6 14.6l-1.1-1.1M6.5 6.5 5.4 5.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

const NAV_ITEMS: { page: Page; icon: ComponentType; labelKey: string }[] = [
  { page: 'rules', icon: RulesIcon, labelKey: 'nav.rules' },
  { page: 'activity', icon: ActivityIcon, labelKey: 'nav.activity' },
  { page: 'settings', icon: SettingsIcon, labelKey: 'nav.settings' },
]

export function Sidebar({ page, onNavigate }: Props) {
  const { t } = useLanguage()

  return (
    <nav className="sidebar">
      <div className="sidebar__brand">PP</div>
      <ul className="sidebar__nav">
        {NAV_ITEMS.map(({ page: itemPage, icon: Icon, labelKey }) => (
          <li key={itemPage}>
            <button
              type="button"
              className={page === itemPage ? 'sidebar__item sidebar__item--active' : 'sidebar__item'}
              onClick={() => onNavigate(itemPage)}
            >
              <Icon />
              <span>{t(labelKey)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
