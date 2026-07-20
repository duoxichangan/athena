import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { deviceStrategy, playerPositionAtFrame, resolveFrameBounds, trajectoryUntilFrame } from './sandboxUtils.js'

const COLORS = ['#0ea5e9', '#8b5cf6', '#f43f5e', '#f59e0b', '#10b981', '#ec4899']

export default function SandTableModal({ poseData, taskId, playerLabels = {}, onClose }) {
  const videoRef = useRef(null)
  const rafRef = useRef(null)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)

  const bounds = useMemo(() => resolveFrameBounds(poseData), [poseData])
  const fps = poseData?.meta?.fps || 30
  const totalFrames = poseData?.meta?.total_frames || 0
  const players = useMemo(() => Object.values(poseData?.players || {}), [poseData])

  // Precompute trajectories once per player (not per frame)
  const playerTrajectories = useMemo(() => {
    return players.map((player) => ({
      trackId: player.track_id,
      frames: player.frames,
    }))
  }, [players])

  const positions = useMemo(() => {
    return players
      .map((player) => {
        const point = playerPositionAtFrame(player.frames, frame, bounds)
        return point && { trackId: player.track_id, ...point }
      })
      .filter(Boolean)
  }, [players, frame, bounds])

  const strategy = useMemo(() => deviceStrategy(positions), [positions])
  const battery = useMemo(() => Math.max(72, 86 - Math.round((frame / Math.max(totalFrames, 1)) * 8)), [frame, totalFrames])

  // rAF-based sync with video — smoother than timeupdate events
  const syncFrame = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const f = Math.min(totalFrames - 1, Math.floor(v.currentTime * fps))
    setFrame(f)
    rafRef.current = requestAnimationFrame(syncFrame)
  }, [fps, totalFrames])

  useEffect(() => {
    if (playing) {
      rafRef.current = requestAnimationFrame(syncFrame)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing, syncFrame])

  // Keyboard & overflow lock
  useEffect(() => {
    const previous = document.body.style.overflow
    const close = (event) => event.key === 'Escape' && onClose()
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', close)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', close)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [onClose])

  function seek(value) {
    const next = Math.max(0, Math.min(totalFrames - 1, Number(value)))
    setFrame(next)
    if (videoRef.current) videoRef.current.currentTime = next / fps
  }

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }

  return createPortal(
    <div className="sandbox-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="sandbox-modal" role="dialog" aria-modal="true" aria-labelledby="sandbox-title">
        <header className="sandbox-header">
          <h2 id="sandbox-title">训练战术沙盘</h2>
          <button className="analysis-modal-close" type="button" onClick={onClose} aria-label="关闭战术沙盘">×</button>
        </header>
        <div className="sandbox-grid">
          <div className="sandbox-video-panel">
            <video
              ref={videoRef}
              src={`/download/${taskId}`}
              preload="auto"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            />
          </div>
          <div className="sandbox-court-panel">
            <Court
              players={players}
              playerTrajectories={playerTrajectories}
              positions={positions}
              playerLabels={playerLabels}
              frame={frame}
              bounds={bounds}
            />
            <DeviceConsole strategy={strategy} playerLabels={playerLabels} battery={battery} />
          </div>
        </div>
        <footer className="sandbox-controls">
          <button className="sandbox-play" type="button" onClick={togglePlay}>
            {playing ? '暂停' : '播放'}
          </button>
          <input
            aria-label="沙盘时间轴"
            type="range"
            min="0"
            max={Math.max(0, totalFrames - 1)}
            value={frame}
            onChange={(e) => seek(e.target.value)}
          />
          <span>{(frame / fps).toFixed(1)}s / {((duration > 0 ? duration : totalFrames / fps)).toFixed(1)}s</span>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function Court({ players, playerTrajectories, positions, playerLabels, frame, bounds }) {
  return (
    <div className="sandbox-court" aria-label="半场球员位置沙盘">
      <div className="court-key court-key-left" />
      <div className="court-key court-key-right" />
      <div className="court-center-line" />
      <div className="court-center-circle" />
      <svg className="sandbox-trails" viewBox="0 0 100 100" preserveAspectRatio="none">
        {playerTrajectories.map((pt, i) => {
          const points = trajectoryUntilFrame(pt.frames, frame, bounds)
            .map((p) => `${p.x * 100},${p.y * 100}`)
            .join(' ')
          return points && (
            <polyline
              key={pt.trackId}
              points={points}
              stroke={COLORS[i % COLORS.length]}
            />
          )
        })}
      </svg>
      {positions.map((point, i) => (
        <div
          key={point.trackId}
          className="sandbox-player"
          title={playerLabels[point.trackId]}
          style={{
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`,
            '--player-color': COLORS[i % COLORS.length],
          }}
        >
          {playerLabels[point.trackId]?.replace('学员 ', '') || point.trackId}
        </div>
      ))}
      <span className="court-label">篮筐方向</span>
    </div>
  )
}

function DeviceConsole({ strategy, playerLabels, battery }) {
  const riskClass = strategy.occlusion === '高' ? 'risk-high' : 'risk-low'
  return (
    <section className="device-console" aria-label="自主移动设备控制台">
      <div className="device-console-head">
        <span>自主移动设备控制台</span>
        <b><i className="device-live-dot" />实时策略</b>
      </div>
      <div className="device-metrics">
        <Metric label="跟随对象" value={strategy.targetId ? playerLabels[strategy.targetId] : '等待目标'} />
        <Metric label="云台状态" value={strategy.gimbal} />
        <Metric label="底盘策略" value={strategy.chassis} />
        <Metric label="遮挡风险" value={strategy.occlusion} className={riskClass} />
        <Metric label="安全状态" value={strategy.safety} className="risk-low" />
        <Metric label="设备电量" value={`${battery}%`} />
      </div>
    </section>
  )
}

function Metric({ label, value, className = '' }) {
  return (
    <div className="device-metric">
      <span>{label}</span>
      <strong className={className}>{value}</strong>
    </div>
  )
}
