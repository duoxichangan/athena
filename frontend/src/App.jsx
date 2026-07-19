import { useEffect, useRef, useState } from 'react'
import { Header, UploadSection, ProgressSection, StatsGrid, ActionBar, ErrorSection, Footer } from './components/Sections.jsx'
import PlayerCard from './components/PlayerCard.jsx'
import SandTableModal from './components/SandTableModal.jsx'
import { uploadFile, pollStatus, fetchPoseData } from './api.js'

export default function App() {
  const [phase, setPhase] = useState('idle') // idle | processing | done | error
  const [taskId, setTaskId] = useState(null)
  const [result, setResult] = useState(null)
  const [poseData, setPoseData] = useState(null)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [activeStep, setActiveStep] = useState(0)
  const [sandboxOpen, setSandboxOpen] = useState(false)

  const timerRef = useRef(null)
  const startRef = useRef(0)

  useEffect(() => () => stopPolling(), [])

  useEffect(() => {
    const selector = [
      '.glass-card',
      '.glass-nav',
      '.glass-footer',
      '.stat-card',
      '.player-card',
      '.upload-zone',
      '.upload-info-bar',
      '.link-btn',
      '.btn-primary',
      '.btn-ghost',
      '.btn-ai',
      '.btn-reanalyze',
      '.analysis-result',
    ].join(',')

    let activeSurface = null

    const move = (e) => {
      document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`)
      document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`)

      const surface = e.target.closest?.(selector)
      if (surface !== activeSurface) {
        activeSurface?.classList.remove('glass-hover')
        activeSurface = surface
        activeSurface?.classList.add('glass-hover')
      }
      if (!surface) return

      const rect = surface.getBoundingClientRect()
      surface.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`)
      surface.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`)
      surface.style.setProperty('--tilt-x', `${((e.clientY - rect.top) / rect.height - 0.5) * -8}deg`)
      surface.style.setProperty('--tilt-y', `${((e.clientX - rect.left) / rect.width - 0.5) * 8}deg`)
    }

    const leave = () => {
      activeSurface?.classList.remove('glass-hover')
      activeSurface = null
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerleave', leave)
    }
  }, [])

  function stopPolling() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function showError(msg) {
    stopPolling()
    setError(msg || '未知错误')
    setPhase('error')
  }

  async function handleSubmit(file) {
    setPhase('processing')
    setActiveStep(0)
    setSandboxOpen(false)
    setElapsed(0)
    setError('')
    setResult(null)
    setPoseData(null)

    try {
      const data = await uploadFile(file)
      if (data.error) {
        showError(data.error)
        return
      }
      const id = data.task_id
      setTaskId(id)
      startPolling(id)
    } catch (err) {
      showError('上传失败: ' + err.message)
    }
  }

  function startPolling(id) {
    startRef.current = Date.now()
    setActiveStep(1)
    timerRef.current = setInterval(async () => {
      const secs = Math.floor((Date.now() - startRef.current) / 1000)
      setElapsed(secs)
      if (secs > 3) setActiveStep(1)
      try {
        const data = await pollStatus(id)
        if (data.status === 'done') {
          stopPolling()
          await showResult(id, data.result)
        } else if (data.status === 'error') {
          showError(data.result?.error || '未知错误')
        }
      } catch (err) {
        showError('查询状态失败: ' + err.message)
      }
    }, 2000)
  }

  async function showResult(id, res) {
    setActiveStep(2)
    setResult(res)
    setPhase('done')
    try {
      const pd = await fetchPoseData(id)
      setPoseData(pd)
    } catch (err) {
      console.error('Failed to load pose data:', err)
    }
  }

  function reset() {
    stopPolling()
    setPhase('idle')
    setTaskId(null)
    setResult(null)
    setPoseData(null)
    setError('')
    setElapsed(0)
    setActiveStep(0)
  }

  // Build player list
  let players = []
  let clips = {}
  if (poseData && result) {
    clips = result.player_clips || {}
    const normClips = {}
    Object.keys(clips).forEach((k) => { normClips[String(k)] = clips[k] })
    const playersMap = poseData.players || {}
    players = Object.keys(playersMap)
      .map((k) => playersMap[k])
      .sort((a, b) => (a.track_id || 0) - (b.track_id || 0))
  }

  return (
    <div className="app">
      <Header />

      <main className="main">
        {phase === 'idle' && <UploadSection onSubmit={handleSubmit} />}

        {phase === 'processing' && (
          <ProgressSection elapsed={elapsed} activeStep={activeStep} />
        )}

        {phase === 'done' && result && (
          <section className="section">
            <StatsGrid result={result} />

            <h2 className="player-count-title">
              跟踪到 <span className="player-count-num">{result.unique_players}</span> 名球员
            </h2>

            <div className="sandbox-launch-wrap">
              <button className="btn-primary sandbox-launch" onClick={() => setSandboxOpen(true)} disabled={!poseData}>
                <span className="btn-primary-label">{poseData ? '打开训练战术沙盘' : '正在载入沙盘数据…'}</span>
              </button>
              <span>多人位置 · 移动轨迹 · 视频同步</span>
            </div>

            <div className="player-gallery">
              {players.map((p) => (
                <PlayerCard
                  key={p.track_id}
                  taskId={taskId}
                  pinfo={p}
                  clipUrl={normClip(clips, p.track_id) ? `/player-clip/${taskId}/${p.track_id}` : null}
                />
              ))}
            </div>

            <ActionBar taskId={taskId} result={result} onReset={reset} />
            {sandboxOpen && <SandTableModal poseData={poseData} taskId={taskId} onClose={() => setSandboxOpen(false)} />}
          </section>
        )}

        {phase === 'error' && <ErrorSection message={error} onRetry={reset} />}
      </main>

      <Footer />
    </div>
  )
}

function normClip(clips, tid) {
  return clips && (clips[String(tid)] || clips[tid])
}
