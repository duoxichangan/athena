import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playerPositionAtFrame, resolveFrameBounds, trajectoryUntilFrame } from './sandboxUtils.js'

const COLORS = ['#0ea5e9', '#8b5cf6', '#f43f5e', '#f59e0b', '#10b981', '#ec4899']

export default function SandTableModal({ poseData, taskId, onClose }) {
  const videoRef = useRef(null)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const bounds = useMemo(() => resolveFrameBounds(poseData), [poseData])
  const fps = poseData?.meta?.fps || 30
  const totalFrames = poseData?.meta?.total_frames || 0
  const players = Object.values(poseData?.players || {})
  useEffect(() => {
    const previous = document.body.style.overflow
    const close = (event) => event.key === 'Escape' && onClose()
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', close)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close) }
  }, [onClose])
  function seek(value) {
    const next = Math.max(0, Math.min(totalFrames - 1, Number(value)))
    setFrame(next)
    if (videoRef.current) videoRef.current.currentTime = next / fps
  }
  return createPortal(
    <div className="sandbox-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="sandbox-modal" role="dialog" aria-modal="true" aria-labelledby="sandbox-title">
        <header className="sandbox-header"><div><span className="analysis-modal-eyebrow">篮眸 · 多人空间分析</span><h2 id="sandbox-title">训练战术沙盘</h2></div><button className="analysis-modal-close" type="button" onClick={onClose} aria-label="关闭战术沙盘">×</button></header>
        <div className="sandbox-grid">
          <div className="sandbox-video-panel"><video ref={videoRef} src={`/download/${taskId}`} controls onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => setFrame(Math.min(totalFrames - 1, Math.floor(e.currentTarget.currentTime * fps)))} /><div className="sandbox-video-caption">原始标注视频 · 与沙盘时间轴同步</div></div>
          <div className="sandbox-court-panel"><Court players={players} frame={frame} bounds={bounds} /><p className="sandbox-note">画面投影版：基于跟踪框底部中心点估算位置；加入球场标定后可提升实际空间精度。</p></div>
        </div>
        <footer className="sandbox-controls"><button className="sandbox-play" type="button" onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}>{playing ? '暂停' : '播放'}</button><input aria-label="沙盘时间轴" type="range" min="0" max={Math.max(0, totalFrames - 1)} value={frame} onChange={(e) => seek(e.target.value)} /><span>{(frame / fps).toFixed(1)}s / {(totalFrames / fps).toFixed(1)}s</span></footer>
      </section>
    </div>, document.body)
}

function Court({ players, frame, bounds }) {
  return <div className="sandbox-court" aria-label="半场球员位置沙盘"><div className="court-key court-key-left" /><div className="court-key court-key-right" /><div className="court-center-line" /><div className="court-center-circle" /><svg className="sandbox-trails" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{players.map((p, i) => { const points = trajectoryUntilFrame(p.frames, frame, bounds).map((point) => `${point.x * 100},${point.y * 100}`).join(' '); return points && <polyline key={p.track_id} points={points} stroke={COLORS[i % COLORS.length]} /> })}</svg>{players.map((p, i) => { const point = playerPositionAtFrame(p.frames, frame, bounds); return point && <div key={p.track_id} className="sandbox-player" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, '--player-color': COLORS[i % COLORS.length] }}>{p.track_id}</div> })}<span className="court-label">篮筐方向</span></div>
}
