import { useState } from 'react'

export default function JsonPanel({ players = [], frameWidth, frameHeight }) {
  const [open, setOpen] = useState(false)

  const payload = {
    players: players.map((p) => {
      const { keypoints: _k, ...rest } = p
      const kpSummary = _k
        ? `${_k.length} keypoints (avg conf ${(_k.reduce((s, k) => s + k.confidence, 0) / _k.length).toFixed(2)})`
        : 'no keypoints'
      return { ...rest, keypoints: kpSummary }
    }),
    frame: frameWidth && frameHeight ? `${frameWidth}×${frameHeight}` : undefined,
  }

  return (
    <div className={`json-panel ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="json-panel-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="json-panel-toggle-label">
          <BracketsIcon />
          {open ? '收起' : '实时数据'}
        </span>
        <span className={`json-panel-chevron ${open ? 'is-open' : ''}`}>
          <ChevronIcon />
        </span>
      </button>
      {open && (
        <pre className="json-panel-body">
          <code>{JSON.stringify(payload, null, 2)}</code>
        </pre>
      )}
    </div>
  )
}

function BracketsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 2L2 5v1l3 3M11 14l3-3v-1l-3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
