import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
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
  const { lang, t } = useLanguage()
  const [tab, setTab] = useState<Tab>('manual')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--help" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="help-header-row">
            <h2>{t('statusBar.help')}</h2>
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
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
