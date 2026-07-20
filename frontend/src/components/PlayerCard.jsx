import { useRef } from 'react'
import SkeletonCanvas from './SkeletonCanvas.jsx'
import AnalysisPanel from './AnalysisPanel.jsx'
import { playerDataUrl, playerClipUrl } from '../api.js'

export default function PlayerCard({ taskId, pinfo, clipUrl, playerName, onRename }) {
  const videoRef = useRef(null)
  const tid = pinfo.track_id
  const firstFrame = pinfo.frames?.[0] || null
  const kpts = firstFrame?.kpts || null

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }

  return (
    <article className="player-card">
      <div className="player-card-inner">
        <div className="player-card-header">
          <span className="player-id-badge">{playerName}</span>
          <button className="player-rename" type="button" onClick={() => {
            const nextName = window.prompt('为该学员命名', playerName)
            if (nextName?.trim()) onRename(nextName.trim())
          }}>命名</button>
          <span className="player-card-stats">
            可见 {pinfo.total_frames_visible} 帧 · {pinfo.visibility_pct}%
          </span>
        </div>

        <div className="player-media">
          <div className="player-skeleton-panel">
            <SkeletonCanvas keypoints={kpts} />
          </div>
          <div className="player-video-panel">
            {clipUrl ? (
              <video
                ref={videoRef}
                src={clipUrl}
                muted
                loop
                preload="metadata"
              />
            ) : (
              <div className="clip-pending">裁剪视频<br />生成中...</div>
            )}
          </div>
        </div>

        <AnalysisPanel taskId={taskId} trackId={tid} playerName={playerName} clipUrl={clipUrl} />

        <div className="player-card-footer">
          <a
            className="link-btn"
            href={playerDataUrl(taskId, tid)}
            download
          >
            <DownloadIcon /> 姿态 JSON
          </a>
          {clipUrl && (
            <>
              <button className="link-btn" onClick={togglePlay}>
                <PlayIcon /> 播放/暂停
              </button>
              <a className="link-btn" href={playerClipUrl(taskId, tid)} download>
                <DownloadIcon /> 视频
              </a>
            </>
          )}
          <span className="frame-range">
            帧 {pinfo.first_seen_frame}–{pinfo.last_seen_frame}
          </span>
        </div>
      </div>
    </article>
  )
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M4 6l4 4 4-4M8 10V2M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <polygon points="4,2 14,8 4,14" fill="currentColor" />
    </svg>
  )
}
