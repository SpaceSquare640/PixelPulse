import { useState } from 'react'
import { EngineControls } from './components/EngineControls'
import { HelpModal } from './components/HelpModal'
import { LogPanel } from './components/LogPanel'
import { RuleEditor } from './components/RuleEditor'
import { RuleList } from './components/RuleList'
import { SettingsPage } from './components/SettingsPage'
import { Sidebar, type Page } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { useLanguage } from './i18n/LanguageContext'
import type { RuleConfig } from './protocol'
import { useEngineSocket } from './useEngineSocket'

function App() {
  const { t } = useLanguage()
  const {
    connectionState,
    rules,
    engineStatus,
    events,
    lastError,
    startEngine,
    stopEngine,
    createRule,
    updateRule,
    deleteRule,
    deleteAllRules,
    toggleRule,
    reorderRules,
    captureCrop,
    capturePixel,
    importImage,
    previewTrigger,
  } = useEngineSocket()

  const [page, setPage] = useState<Page>('rules')
  // null = closed, 'new' = creating a rule, a RuleConfig = editing that rule.
  const [editorState, setEditorState] = useState<RuleConfig | 'new' | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)

  const editingRule = editorState === 'new' || editorState === null ? null : editorState

  async function handleBatchUpload() {
    if (!window.pixelpulse) return
    const paths = await window.pixelpulse.pickImageFiles()
    if (!paths || paths.length === 0) return

    setBatchUploading(true)
    setBatchError(null)

    // Default names are plain sequential numbers ("1", "2", ...), picking up
    // after the highest number already in use so a batch never collides
    // with existing rules (manual or from an earlier batch). Users can
    // rename any of them afterward via Edit.
    // 預設名稱是單純的流水號（「1」、「2」...），從目前已經用掉的最大數字
    // 之後接著編，這樣批次上傳就不會跟既有規則（手動建立或前一批上傳的）
    // 撞名。使用者之後隨時可以用「編輯」重新命名。
    const usedNames = new Set(rules.map((r) => r.name))
    let nextNumber = 1
    for (const name of usedNames) {
      if (/^\d+$/.test(name)) nextNumber = Math.max(nextNumber, Number(name) + 1)
    }

    const failedFiles: string[] = []
    for (const path of paths) {
      while (usedNames.has(String(nextNumber))) nextNumber++
      const name = String(nextNumber)
      try {
        const result = await importImage(path, name)
        createRule({
          name,
          trigger: { kind: 'template', roi: null, image: result.imagePath, threshold: 0.85 },
          action: { kind: 'click', button: 'left' },
          cooldownMs: 1000,
          maxTriggers: null,
          oncePerAppearance: false,
          dryRun: true,
        })
        usedNames.add(name)
        nextNumber++
      } catch {
        failedFiles.push(path.split(/[/\\]/).pop() ?? path)
      }
    }

    setBatchUploading(false)
    if (failedFiles.length > 0) {
      setBatchError(t('ruleList.batchUploadFailed', { files: failedFiles.join(', ') }))
    }
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={setPage} />
      <div className="app">
        <StatusBar connectionState={connectionState} />
        {lastError && <div className="error-banner">{lastError}</div>}
        {batchError && <div className="error-banner">{batchError}</div>}
        <main className="app__body">
          {page === 'rules' && (
            <>
              <EngineControls
                connected={connectionState === 'open'}
                status={engineStatus}
                onStart={startEngine}
                onStop={stopEngine}
              />
              <RuleList
                rules={rules}
                onToggle={toggleRule}
                onEdit={(rule) => setEditorState(rule)}
                onDelete={deleteRule}
                onDeleteAll={deleteAllRules}
                onReorder={reorderRules}
                onNewRule={() => setEditorState('new')}
                onBatchUpload={handleBatchUpload}
                batchUploading={batchUploading}
              />
            </>
          )}

          {page === 'activity' && <LogPanel events={events} />}

          {page === 'settings' && <SettingsPage onOpenHelp={() => setHelpOpen(true)} />}
        </main>

        {editorState !== null && (
          <RuleEditor
            existingNames={rules.map((r) => r.name)}
            existingRule={editingRule}
            onClose={() => setEditorState(null)}
            onSave={(rule) => {
              createRule(rule)
              setEditorState(null)
            }}
            onUpdate={(originalName, rule) => {
              updateRule(originalName, rule)
              setEditorState(null)
            }}
            captureCrop={captureCrop}
            capturePixel={capturePixel}
            importImage={importImage}
            previewTrigger={previewTrigger}
          />
        )}

        {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      </div>
    </div>
  )
}

export default App
