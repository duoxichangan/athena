import { useEffect, useRef, useState } from 'react'
import { sendLiveFrame, startLiveSession, stopLiveSession } from '../api.js'
import LiveCourtMap from './LiveCourtMap.jsx'

const CAPTURE_INTERVAL_MS = 180
const MAX_TRAIL_POINTS = 30

export default function LiveTraining() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [players, setPlayers] = useState([])
  const [history, setHistory] = useState({})
  const [mapExpanded, setMapExpanded] = useState(false)
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

        {status === 'idle' ? (
          <button className="btn-primary live-start-button" type="button" onClick={startTraining}>
            <span className="btn-primary-label">开启实时训练</span>
          </button>
        ) : (
          <div className="live-status-actions">
            <span><i className="device-live-dot" />{status === 'live' ? '训练中' : status === 'preview' ? '本地预览' : '正在启动'}</span>
            <button className="btn-ghost" type="button" onClick={stopTraining}>
              <span className="btn-ghost-label">结束训练</span>
            </button>
          </div>
        )}

        <div className={`live-video-stage ${status === 'idle' ? 'is-idle' : ''}`}>
          <video ref={videoRef} autoPlay muted playsInline aria-label="实时训练画面" />
          {status === 'idle' && <div className="live-video-placeholder">开启摄像头后，这里将显示训练画面</div>}
          {status !== 'idle' && (
            <LiveCourtMap
              players={players}
              history={history}
              expanded={mapExpanded}
              onExpand={() => setMapExpanded((value) => !value)}
            />
          )}
        </div>
        <canvas ref={canvasRef} className="live-capture-canvas" aria-hidden="true" />
        {error && <p className="live-training-error" role="alert">{error}</p>}
      </div>
    </section>
  )
}

export function appendHistory(current, players) {
  const next = { ...current }
  players.forEach((player) => {
    next[player.track_id] = [...(next[player.track_id] || []), { x: player.x, y: player.y }].slice(-MAX_TRAIL_POINTS)
  })
  return next
}
