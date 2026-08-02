import type { EngineStatus } from '../useEngineSocket'

interface Props {
  connected: boolean
  status: EngineStatus
  onStart: () => void
  onStop: () => void
}

export function EngineControls({ connected, status, onStart, onStop }: Props) {
  return (
    <section className="panel engine-controls">
      <div>
        <div className={`engine-state engine-state--${status.running ? 'running' : 'stopped'}`}>
          <span className="dot" />
          {status.running ? 'Running' : 'Stopped'}
        </div>
        <p className="muted">{status.ruleCount} rule(s) loaded</p>
      </div>
      <button
        type="button"
        className={status.running ? 'button button--danger' : 'button button--primary'}
        disabled={!connected}
        onClick={status.running ? onStop : onStart}
      >
        {status.running ? 'Stop' : 'Start'}
      </button>
    </section>
  )
}
