import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PickerOverlay } from './components/PickerOverlay'
import { LanguageProvider } from './i18n/LanguageContext'

const params = new URLSearchParams(window.location.search)
const pickerMode = params.get('picker')

function renderRoot() {
  if (pickerMode === 'region' || pickerMode === 'point') {
    document.documentElement.classList.add('picker-mode')
    const originX = Number(params.get('originX') ?? 0)
    const originY = Number(params.get('originY') ?? 0)
    return <PickerOverlay mode={pickerMode} originX={originX} originY={originY} />
  }
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>{renderRoot()}</LanguageProvider>
  </StrictMode>,
)
