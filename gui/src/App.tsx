import { EngineControls } from './components/EngineControls'
import { LogPanel } from './components/LogPanel'
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
    deleteRule,
    toggleRule,
  } = useEngineSocket()

  return (
    <div className="app">
      <StatusBar connectionState={connectionState} />
      {lastError && <div className="error-banner">{lastError}</div>}
      <main className="app__body">
        <EngineControls
          connected={connectionState === 'open'}
          status={engineStatus}
          onStart={startEngine}
          onStop={stopEngine}
        />
        <RuleList rules={rules} onToggle={toggleRule} onDelete={deleteRule} />
        <LogPanel events={events} />
      </main>
    </div>
  )
}

export default App
