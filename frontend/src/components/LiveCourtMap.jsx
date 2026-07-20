const PLAYER_COLORS = ['#ff6b35', '#35d6ff', '#d968ff', '#ffe45e', '#66f28f', '#ff78a8']

export default function LiveCourtMap({ players = [], history = {}, onExpand, expanded = false }) {
  return (
    <section className={`live-court-map ${expanded ? 'is-expanded' : ''}`} aria-label="实时半场位置图">
      <header className="live-court-map-head">
        <strong>半场点位</strong>
        <span>相对位置</span>
      </header>
      <button
        type="button"
        className="live-court-stage"
        onClick={onExpand}
        aria-label={expanded ? '收起半场位置图' : '展开半场位置图'}
      >
        <svg className="live-court-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect x="2" y="2" width="96" height="96" rx="2" />
          <path d="M2 65 H98 M32 2 V34 H68 V2 M32 34 Q50 52 68 34" />
          <circle cx="50" cy="14" r="3" />
          <path d="M42 7 H58 M50 7 V2" />
        </svg>
        {Object.entries(history).map(([trackId, points], colorIndex) => {
          const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length]
          const recent = points.slice(-30)
          if (recent.length < 2) return null
          return (
            <svg key={`trail-${trackId}`} className="live-court-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={recent.map((point) => `${point.x * 100},${point.y * 100}`).join(' ')} style={{ stroke: color }} />
            </svg>
          )
        })}
        {players.map((player, index) => {
          const color = PLAYER_COLORS[index % PLAYER_COLORS.length]
          return (
            <span
              key={player.track_id}
              className="live-player-dot"
              aria-label={`学员 ${player.track_id}`}
              style={{ left: `${player.x * 100}%`, top: `${player.y * 100}%`, '--player-color': color }}
            >
              <b>{player.track_id}</b>
            </span>
          )
        })}
        {!players.length && <span className="live-court-empty">等待识别球员</span>}
      </button>
    </section>
  )
}
