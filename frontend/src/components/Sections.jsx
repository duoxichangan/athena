import { useEffect, useRef, useState } from 'react'

/* ---------------- Header ---------------- */
export function Header() {
  return (
    <header className="nav-wrap">
      <div className="glass-nav">
        <div className="nav-inner">
          <div className="nav-brand">
            <AthenaLogo />
            <span className="brand-title">Athena</span>
            <span className="brand-sub hidden-sm">运动员姿态识别平台</span>
          </div>
          <span className="brand-sub hidden-sm">Basketball Pose Analysis</span>
        </div>
      </div>
    </header>
  )
}

/* ---------------- Upload ---------------- */
export function UploadSection({ onSubmit }) {
  const [file, setFile] = useState(null)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)

  function handleFile(f) {
    const ext = f.name.split('.').pop().toLowerCase()
    const allowed = ['mp4', 'avi', 'mov', 'mkv', 'webm']
    if (!allowed.includes(ext)) {
      alert(`不支持的格式 .${ext}，请上传 ${allowed.join('/')} 文件`)
      return
    }
    if (f.size > 200 * 1024 * 1024) {
      alert('文件大小超过 200MB 限制')
      return
    }
    setFile(f)
  }

  function formatSize(b) {
    if (b < 1024) return b + ' B'
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
    return (b / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <section className="section narrow">
      <div className="glass-card upload-shell">
        <div className="upload-card">
          <h1 className="hero-title">上传视频，开启分析</h1>
          <p className="hero-sub">支持 MP4 / AVI / MOV / MKV / WebM 格式 · 最大 200MB</p>

          <div
            className={`upload-zone ${drag ? 'dragover' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                inputRef.current?.click()
              }
            }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault(); setDrag(false)
              if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0])
            }}
          >
            <div className="upload-icon">
              <UploadIcon />
            </div>
            <p className="upload-hint">拖拽视频文件到此处，或点击上传</p>
            <input
              ref={inputRef}
              type="file"
              accept=".mp4,.avi,.mov,.mkv,.webm"
              hidden
              onChange={(e) => e.target.files.length && handleFile(e.target.files[0])}
            />
          </div>

          {file && (
            <div className="upload-info-bar">
              <span className="filename">{file.name}</span>
              <span className="file-size">{formatSize(file.size)}</span>
              <button className="btn-primary" onClick={() => onSubmit(file)}>
                <span className="btn-primary-label">开始处理</span>
              </button>
              <button className="btn-ghost" onClick={() => setFile(null)}>
                <span className="btn-ghost-label">取消</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/* ---------------- Progress ---------------- */
export function ProgressSection({ elapsed, activeStep }) {
  const steps = ['上传', '处理', '完成']
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`

  return (
    <section className="section narrow">
      <div className="glass-card progress-shell">
        <div className="progress-card">
          <div className="steps">
            {steps.map((label, i) => (
              <div
                key={label}
                className={`step ${i < activeStep ? 'done' : i === activeStep ? 'active' : ''}`}
              >
                <div className="step-dot" />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-shimmer" />
          </div>
          <p className="progress-text">正在处理中... 已用时 {mins} 分 {String(secs).padStart(2, '0')} 秒</p>
          <p className="progress-time">已用时 {timeStr}</p>
        </div>
      </div>
    </section>
  )
}

/* ---------------- Stats ---------------- */
function CountUp({ target, duration = 800 }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - p) * (1 - p)
      setVal(Math.floor(eased * target))
      if (p < 1) raf = requestAnimationFrame(tick)
      else setVal(target)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return <>{val}</>
}

export function StatsGrid({ result }) {
  const stats = [
    { label: '跟踪球员数', value: result.unique_players },
    { label: '处理帧数', value: result.processed_frames },
    { label: '总帧数', value: result.total_frames },
    { label: '耗时 (秒)', value: result.duration_seconds },
  ]
  return (
    <div className="stats-grid">
      {stats.map((s) => (
        <div key={s.label} className="stat-card">
          <div className="stat-value">
            <CountUp target={s.value || 0} />
          </div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

/* ---------------- Action Bar ---------------- */
export function ActionBar({ taskId, result, onReset }) {
  const videoName = result.output_path?.split(/[/\\]/).pop() || 'output.mp4'
  const dataName = result.data_path?.split(/[/\\]/).pop() || 'pose_data.json'
  return (
    <div className="action-bar-wrap">
      <div className="glass-card action-bar">
        <a className="link-btn" href={`/download/${taskId}`} download={videoName}>
          <DownloadIcon /> 下载主视频
        </a>
        <a className="link-btn" href={`/data/${taskId}`} download={dataName}>
          <DownloadIcon /> 下载姿态数据 (JSON)
        </a>
        <button className="btn-ghost" onClick={onReset}>
          <span className="btn-ghost-label">处理新视频</span>
        </button>
      </div>
    </div>
  )
}

/* ---------------- Error ---------------- */
export function ErrorSection({ message, onRetry }) {
  return (
    <section className="section narrow">
      <div className="glass-card error-card">
        <div className="error-card-inner">
          <AlertIcon />
          <h2 className="err-title">处理失败</h2>
          <p className="err-msg">{message}</p>
          <button className="btn-primary" onClick={onRetry}>
            <span className="btn-primary-label">重新上传</span>
          </button>
        </div>
      </div>
    </section>
  )
}

/* ---------------- Footer ---------------- */
export function Footer() {
  return (
    <footer className="footer-wrap">
      <div className="glass-footer">
        <div className="footer-inner">
          <span className="footer-text">Athena 运动员姿态识别平台</span>
          <span className="footer-sub">Powered by Ultralytics YOLO Pose · FastAPI · DeepSeek</span>
        </div>
      </div>
    </footer>
  )
}

/* ---------------- Icons ---------------- */
function AthenaLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-label="Athena">
      <circle cx="16" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="11" x2="16" y2="18" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="14" x2="10" y2="20" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="14" x2="22" y2="20" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="18" x2="10" y2="26" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="18" x2="22" y2="26" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
function UploadIcon() {
  return (
    <svg width="46" height="46" viewBox="0 0 48 48" fill="none">
      <rect x="4" y="4" width="40" height="40" rx="20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.45" />
      <path d="M24 32V14M24 14L16 22M24 14L32 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 36V40C12 41.1 12.9 42 14 42H34C35.1 42 36 41.1 36 40V36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 11V3M8 11L5 8M8 11L11 8M2 13H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg width="46" height="46" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" stroke="#ef4444" strokeWidth="2" opacity="0.4" />
      <path d="M24 16v10M24 30h.01" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
