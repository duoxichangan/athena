import { useEffect, useRef, useState } from 'react'
import lanmouBadge from '../assets/lanmou-badge.png'

/* ---------------- Header ---------------- */
export function Header() {
  return (
    <header className="nav-wrap">
      <div className="glass-nav">
        <div className="nav-inner">
          <div className="nav-brand">
            <img className="brand-badge" src={lanmouBadge} alt="篮眸徽标" />
            <span className="brand-title">篮眸</span>
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
    onSubmit(f)
  }

  return (
    <section className="section">
      <div className="glass-card upload-shell">
        <div className="upload-copy">
          <span className="mode-kicker">赛后分析</span>
          <h1 className="upload-title">录像复盘</h1>
          <p className="upload-desc">上传完整训练视频，生成球员姿态、轨迹与 AI 建议 · 最大 200MB</p>
        </div>

        <div className="upload-card">

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

        </div>
      </div>
    </section>
  )
}

/* ---------------- Progress ---------------- */
const FUN_TIPS = [
  '正在飞速加载中… 🚀',
  '篮球在飞，数据在跑 🏀',
  'AI 正在逐帧分析你的英姿…',
  '姿势识别引擎全力运转中 ⚡',
  '正在追踪每一个精彩瞬间…',
  '准备为你生成专业分析报告 📊',
  '请稍候，精彩即将呈现 ✨',
  '骨骼关键点检测进行中…',
  '正在计算球员移动轨迹 📐',
  '别眨眼，好戏马上开场 🎬',
  '你的高光时刻即将揭晓 🌟',
  '正在召唤 DeepSeek 解读战术… 🧠',
  '数据加载中，先来一个三分球 🎯',
  '每一帧都在变魔法 🪄',
]

export function ProgressSection({ elapsed, activeStep, videoUrl }) {
  const phases = [
    { key: 'upload', label: '上传', icon: '📤' },
    { key: 'process', label: '分析', icon: '🔍' },
    { key: 'done', label: '完成', icon: '✨' },
  ]
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`

  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % FUN_TIPS.length)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="section">
      {/* Video preview card */}
      {videoUrl && (
        <div className="glass-card video-preview-card">
          <div className="video-preview-inner">
            <div className="video-preview-stage">
              <video
                src={videoUrl}
                controls
                muted
                autoPlay
                playsInline
                loop
                className="video-preview-el"
              />
              <div className="video-preview-overlay">
                <span className="video-preview-badge">正在分析此录像</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card progress-shell">
        <div className="progress-card">
          {/* Phase indicator — elegant rings + connectors */}
          <div className="phase-track">
            {phases.map((p, i) => (
              <div className="phase-node-group" key={p.key}>
                <div className="phase-ring-wrap">
                  <div
                    className={`phase-ring ${
                      i < activeStep ? 'is-done' : i === activeStep ? 'is-active' : ''
                    }`}
                  >
                    {i < activeStep ? (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8.5L6.5 12L13 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="phase-ring-icon">{p.icon}</span>
                    )}
                  </div>
                  <span className={`phase-ring-label ${i === activeStep ? 'is-active' : ''}`}>
                    {p.label}
                  </span>
                </div>
                {i < phases.length - 1 && (
                  <div className={`phase-connector ${i < activeStep ? 'is-done' : ''}`} />
                )}
              </div>
            ))}
          </div>

          {/* Activity wave — subtle animated dots instead of chunky bar */}
          <div className="activity-wave">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="activity-dot"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>

          <div className="progress-loader">
            <div className="bball-stage">
              <div className="bball" />
              <div className="bball-shadow" />
              <span className="bball-spark bball-spark--1" />
              <span className="bball-spark bball-spark--2" />
              <span className="bball-spark bball-spark--3" />
            </div>
            <p key={tipIndex} className="progress-fun-tip">{FUN_TIPS[tipIndex]}</p>
            <p className="progress-elapsed">已用时 {timeStr}</p>
          </div>
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
          <span className="footer-text">篮眸 运动员姿态识别平台</span>
          <span className="footer-sub">Powered by Ultralytics YOLO Pose · Group 13</span>
        </div>
      </div>
    </footer>
  )
}

/* ---------------- Icons ---------------- */
function UploadIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <rect x="7" y="5" width="30" height="34" rx="5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M22 28V14M22 14L15 21M22 14L29 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 34h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
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
