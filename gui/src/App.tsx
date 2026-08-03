import { useState } from 'react'
import { EngineControls } from './components/EngineControls'
import { HelpModal } from './components/HelpModal'
import { LogPanel } from './components/LogPanel'
import { RuleEditor } from './components/RuleEditor'
import { RuleList } from './components/RuleList'
import { StatusBar } from './components/StatusBar'
import type { RuleConfig } from './protocol'
import { useEngineSocket } from './useEngineSocket'

function App() {
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

  // null = closed, 'new' = creating a rule, a RuleConfig = editing that rule.
  const [editorState, setEditorState] = useState<RuleConfig | 'new' | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const editingRule = editorState === 'new' || editorState === null ? null : editorState

  return (
    <div className="app">
      <StatusBar connectionState={connectionState} onOpenHelp={() => setHelpOpen(true)} />
      {lastError && <div className="error-banner">{lastError}</div>}
      <main className="app__body">
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
        />

        <LogPanel events={events} />
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
  )
}

export default App
