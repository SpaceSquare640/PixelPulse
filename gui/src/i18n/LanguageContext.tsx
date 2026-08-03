// App-wide language switcher: a small hand-rolled i18n layer (no library)
// backed by plain JSON dictionaries in ./locales. Kept lightweight on
// purpose, matching how the Help modal's content was written -- this is
// static, self-authored text, not a case that needs a full i18n framework.
//
// 全域語言切換：不用額外的 i18n 套件，用純 JSON 字典（見 ./locales）手寫的
// 輕量翻譯層。刻意保持簡單，跟說明面板內容的做法一致——這些都是靜態、
// 自己撰寫的文字，不需要整套 i18n 框架。

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import en from './locales/en.json'
import zh from './locales/zh.json'

export type Lang = 'en' | 'zh'

const LOCALES: Record<Lang, unknown> = { en, zh }
const STORAGE_KEY = 'pixelpulse.lang'

function detectDefaultLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'zh') return stored
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

function getNested(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match))
}

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: TranslateFn
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectDefaultLang)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  const t = useMemo<TranslateFn>(
    () => (key, vars) => {
      const value = getNested(LOCALES[lang], key)
      if (typeof value !== 'string') {
        console.warn(`Missing translation for key "${key}" in "${lang}"`)
        return key
      }
      return interpolate(value, vars)
    },
    [lang],
  )

  const value = useMemo<LanguageContextValue>(() => ({ lang, setLang, t }), [lang, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage() must be called within a <LanguageProvider>.')
  }
  return ctx
}
