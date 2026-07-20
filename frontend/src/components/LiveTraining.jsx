import { useEffect, useRef, useState } from 'react'
import { sendLiveFrame, startLiveSession, stopLiveSession } from '../api.js'
import LiveCourtMap from './LiveCourtMap.jsx'
import SkeletonOverlay from './SkeletonOverlay.jsx'
import JsonPanel from './JsonPanel.jsx'

const CAPTURE_INTERVAL_MS = 180
const MAX_TRAIL_POINTS = 30

export default function LiveTraining() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [players, setPlayers] = useState([])
  const [history, setHistory] = useState({})
  const [mapExpanded, setMapExpanded] = useState(false)
  const [frameSize, setFrameSize] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const sessionRef = useRef(null)
  const timerRef = useRef(null)
  const requestPendingRef = useRef(false)

  useEffect(() => () => { void stopTraining() }, [])

  async function startTraining() {
    setStatus('starting')
    setError('')
    let stream
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera unavailable')
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        void videoRef.current.play?.().catch(() => {})
      }
      setStatus('preview')
    } catch {
      releaseCamera()
      setStatus('idle')
      setError('无法访问电脑摄像头，请检查浏览器权限。')
      return
    }

    try {
      const session = await startLiveSession()
      sessionRef.current = session.session_id
      setStatus('live')
      timerRef.current = window.setInterval(captureFrame, CAPTURE_INTERVAL_MS)
    } catch {
      setStatus('preview')
      setError('AI 实时标注暂不可用，摄像头画面仍可继续查看。')
    }
  }

  async function captureFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    const sessionId = sessionRef.current
    if (!video || !canvas || !sessionId || requestPendingRef.current || !video.videoWidth) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    requestPendingRef.current = true
    canvas.toBlob(async (blob) => {
      if (!blob) {
        requestPendingRef.current = false
        return
      }
      try {
        const data = await sendLiveFrame(sessionId, blob)
        const nextPlayers = data.players || []
        setPlayers(nextPlayers)
        setHistory((current) => appendHistory(current, nextPlayers))
        if (data.frame_width && data.frame_height) {
          setFrameSize({ width: data.frame_width, height: data.frame_height })
        }
        setError('')
      } catch {
        setError('实时标注暂不可用，本地画面将继续显示。')
      } finally {
        requestPendingRef.current = false
      }
    }, 'image/jpeg', 0.72)
  }

  async function stopTraining() {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    const sessionId = sessionRef.current
    sessionRef.current = null
    if (sessionId) {
      try { await stopLiveSession(sessionId) } catch { /* session cleanup is best effort */ }
    }
    releaseCamera()
    setPlayers([])
    setHistory({})
    setMapExpanded(false)
    setFrameSize(null)
    setStatus('idle')
  }

  function releaseCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  return (
    <section className="section live-training-section" aria-labelledby="live-training-title">
      <div className="glass-card live-training-shell">
        <div className="live-training-copy">
          <span className="mode-kicker">实时鹰眼</span>
          <h1 id="live-training-title">实时训练</h1>
          <p>电脑摄像头本地预览，AI 抽帧识别球员并同步半场点位。</p>
        </div>

        {status !== 'idle' && (
          <div className="live-status-actions">
            <span><i className="device-live-dot" />{status === 'live' ? '训练中' : status === 'preview' ? '本地预览' : '正在启动'}</span>
            <button className="btn-ghost" type="button" onClick={stopTraining}>
              <span className="btn-ghost-label">结束训练</span>
            </button>
          </div>
        )}

        <div
          className={`live-video-stage ${status === 'idle' ? 'is-idle' : ''} ${status === 'starting' ? 'is-loading' : ''}`}
          {...(status === 'idle' ? {
            onClick: startTraining,
            role: 'button',
            tabIndex: 0,
            'aria-label': '开启实时训练，调用电脑摄像头',
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                startTraining()
              }
            }
          } : {})}
        >
          <video ref={videoRef} autoPlay muted playsInline aria-label="实时训练画面" />
          {status === 'idle' && (
            <div className="live-video-placeholder">
              <div className="live-video-placeholder-icon">
                <CameraIcon />
              </div>
              <p className="live-video-placeholder-text">开启摄像头后，这里将显示训练画面</p>
              <div className="live-video-placeholder-notice">
                <InfoCircleIcon />
                <span>请允许浏览器使用摄像头权限</span>
              </div>
            </div>
          )}
          {status === 'starting' && (
            <div className="live-video-loading">
              <div className="live-video-spinner" />
              <p className="live-video-loading-text">正在启动摄像头...</p>
            </div>
          )}
          {status !== 'idle' && (
            <>
              <SkeletonOverlay players={players} />
              <LiveCourtMap
                players={players}
                history={history}
                expanded={mapExpanded}
                onExpand={() => setMapExpanded((value) => !value)}
              />
            </>
          )}
        </div>
        <canvas ref={canvasRef} className="live-capture-canvas" aria-hidden="true" />
        {status !== 'idle' && players.length > 0 && (
          <JsonPanel players={players} frameWidth={frameSize?.width} frameHeight={frameSize?.height} />
        )}
        {error && <p className="live-training-error" role="alert">{error}</p>}
      </div>
    </section>
  )
}

function CameraIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <rect x="6" y="14" width="40" height="28" rx="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M20 14l2-4h8l2 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="26" cy="28" r="8" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="26" cy="28" r="3" fill="currentColor" opacity="0.55" />
    </svg>
  )
}

function InfoCircleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="7" stroke="currentColor" strokeWidth="1.1" />
      <path d="M7.5 6.5v4.5M7.5 4.5v.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function appendHistory(current, players) {
  const next = { ...current }
  players.forEach((player) => {
    next[player.track_id] = [...(next[player.track_id] || []), { x: player.x, y: player.y }].slice(-MAX_TRAIL_POINTS)
  })
  return next
}
