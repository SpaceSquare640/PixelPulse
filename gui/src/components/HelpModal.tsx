import { useState } from 'react'
import { PrivacyPolicyContent } from '../content/privacyPolicy'
import { TermsOfServiceContent } from '../content/termsOfService'
import { UserManualContent } from '../content/userManual'

type Tab = 'manual' | 'terms' | 'privacy'
type Lang = 'en' | 'zh'

interface Props {
  onClose: () => void
}

const TAB_LABELS: Record<Tab, Record<Lang, string>> = {
  manual: { en: 'User Manual', zh: '教學手冊' },
  terms: { en: 'Terms of Service', zh: '使用條款' },
  privacy: { en: 'Privacy Policy', zh: '隱私權政策' },
}

export function HelpModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('manual')
  const [lang, setLang] = useState<Lang>('zh')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--help" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="help-header-row">
            <h2>{lang === 'zh' ? '說明' : 'Help'}</h2>
            <div className="segmented help-lang-toggle">
              <button
                type="button"
                className={lang === 'zh' ? 'segmented__option segmented__option--active' : 'segmented__option'}
                onClick={() => setLang('zh')}
              >
                繁體中文
              </button>
              <button
                type="button"
                className={lang === 'en' ? 'segmented__option segmented__option--active' : 'segmented__option'}
                onClick={() => setLang('en')}
              >
                English
              </button>
            </div>
          </div>
          <div className="help-tabs">
            {(Object.keys(TAB_LABELS) as Tab[]).map((key) => (
              <button
                key={key}
                type="button"
                className={tab === key ? 'help-tabs__item help-tabs__item--active' : 'help-tabs__item'}
                onClick={() => setTab(key)}
              >
                {TAB_LABELS[key][lang]}
              </button>
            ))}
          </div>
        </div>

        <div className="modal__body">
          {tab === 'manual' && <UserManualContent lang={lang} />}
          {tab === 'terms' && <TermsOfServiceContent lang={lang} />}
          {tab === 'privacy' && <PrivacyPolicyContent lang={lang} />}
        </div>

        <div className="modal__footer">
          <div className="modal__footer-spacer" />
          <button type="button" className="button button--primary" onClick={onClose}>
            {lang === 'zh' ? '關閉' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
