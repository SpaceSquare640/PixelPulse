import { useState } from 'react'
import { EngineControls } from './components/EngineControls'
import { HelpModal } from './components/HelpModal'
import { LogPanel } from './components/LogPanel'
import { RuleEditor } from './components/RuleEditor'
import { RuleList } from './components/RuleList'
import { StatusBar } from './components/StatusBar'
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
    deleteRule,
    toggleRule,
    reorderRules,
    captureCrop,
    capturePixel,
    importImage,
    previewTrigger,
  } = useEngineSocket()

  const [editorOpen, setEditorOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

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
          onDelete={deleteRule}
          onReorder={reorderRules}
          onNewRule={() => setEditorOpen(true)}
        />

        <LogPanel events={events} />
      </main>

      {editorOpen && (
        <RuleEditor
          existingNames={rules.map((r) => r.name)}
          onClose={() => setEditorOpen(false)}
          onSave={(rule) => {
            createRule(rule)
            setEditorOpen(false)
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
