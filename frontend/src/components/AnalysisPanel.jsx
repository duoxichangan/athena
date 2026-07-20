import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { analyzePlayer } from '../api.js'

function escapeText(s) {
  return s == null ? '' : String(s)
}

const THINKING_TIPS = [
  '拼命思考中...',
  '正在分析运动轨迹与方向偏好...',
  '评估身体对称性与平衡能力...',
  '计算关节角度与姿态分布...',
  '对比左右侧发力模式...',
  '即将生成技术报告...',
]

export default function AnalysisPanel({ taskId, trackId, playerName = `学员 ${trackId}`, clipUrl }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null) // {analysis, cached, error}
  const [tipIndex, setTipIndex] = useState(0)
  const tipTimerRef = useRef(null)

  const clearTipTimer = useCallback(() => {
    if (tipTimerRef.current) {
      clearInterval(tipTimerRef.current)
      tipTimerRef.current = null
    }
  }, [])

  async function run(force = false) {
    setOpen(true)
    setLoading(true)
    setData(null)
    // Start rotating tips
    setTipIndex(0)
    clearTipTimer()
    tipTimerRef.current = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % THINKING_TIPS.length)
    }, 2200)
    try {
      const res = await analyzePlayer(taskId, trackId, force)
      setData(res)
    } catch (err) {
      setData({ error: '网络错误: ' + err.message })
    } finally {
      clearTipTimer()
      setLoading(false)
    }
  }

  const a = data?.analysis

  useEffect(() => {
    if (!open) {
      clearTipTimer()
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
      clearTipTimer()
    }
  }, [open, clearTipTimer])

  return (
    <div className="analysis-wrap">
      <div className="analysis-trigger">
        <button
          type="button"
          onClick={() => (loading ? null : run(false))}
          className="btn-ai"
        >
          <span className="btn-ai-label">
            <SparkIcon /> AI 分析
          </span>
        </button>
      </div>

      {open && createPortal(
        <div className="analysis-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}>
          <section
            className="analysis-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`analysis-title-${trackId}`}
          >
            <header className="analysis-modal-header">
              <h2 id={`analysis-title-${trackId}`}>{playerName} · AI 分析</h2>
              <button className="analysis-modal-close" type="button" onClick={() => setOpen(false)} aria-label="关闭分析弹窗">
                ×
              </button>
            </header>

            <div className="analysis-modal-grid">
              <aside className="analysis-modal-video">
                {clipUrl ? (
                  <video src={clipUrl} controls loop preload="metadata" />
                ) : (
                  <div className="analysis-video-empty">该球员视频仍在生成中</div>
                )}
                <p>播放视频，对照右侧建议逐项检查动作细节。</p>
              </aside>

              <div className="analysis-modal-report">
                {loading && <AnalysisThinking tip={THINKING_TIPS[tipIndex]} />}
                {!loading && data?.error && <div className="analysis-error">{escapeText(data.error)}</div>}
                {!loading && a && <AnalysisContent analysis={a} onReanalyze={() => run(true)} />}
              </div>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  )
}

function AnalysisThinking({ tip }) {
  return (
    <div className="analysis-thinking">
      <div className="ai-thinking-visual">
        <div className="ai-brain-pulse">
          <SparkIconLarge />
        </div>
        <div className="ai-orbits">
          <span className="ai-orbit ai-orbit--1" />
          <span className="ai-orbit ai-orbit--2" />
          <span className="ai-orbit ai-orbit--3" />
        </div>
      </div>
      <div className="ai-thinking-dots">
        <span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" />
        <span className="ai-dot" /><span className="ai-dot" />
      </div>
      <p className="ai-thinking-tip" key={tip}>{tip}</p>
      <p className="ai-thinking-sub">AI 正在仔细评估每一项技术指标，请稍候…</p>
    </div>
  )
}

function AnalysisContent({ analysis: a, onReanalyze }) {
  return (
    <div className="analysis-content">
      {a.strengths?.length > 0 && <Section title="优势" variant="strengths" items={a.strengths} />}
      {a.weaknesses?.length > 0 && <Section title="短板" variant="weaknesses" items={a.weaknesses} />}
      {a.summary && (
        <div className="analysis-section">
          <div className="section-title summary">总体评价</div>
          <Markdown content={a.summary} className="summary-text" />
        </div>
      )}
      {a.recommendations?.length > 0 && <Section title="改进建议" variant="recommendations" items={a.recommendations} />}
      {a.additional_angles?.length > 0 && <Section title="补充观察建议" variant="additional" items={a.additional_angles} />}
      {!a.strengths && !a.weaknesses && !a.summary && !a.recommendations && !a.additional_angles && a.raw_response && (
        <Markdown content={a.raw_response} className="summary-text" />
      )}
      <button className="btn-reanalyze" onClick={onReanalyze}>重新分析</button>
    </div>
  )
}

function Section({ title, variant, items }) {
  return (
    <div className="analysis-section">
      <div className={`section-title ${variant}`}>{title}</div>
      <ul className={`analysis-list ${variant}-list`}>
        {items.map((it, i) => (
          <li key={i}><Markdown content={it} compact /></li>
        ))}
      </ul>
    </div>
  )
}

function Markdown({ content, className = '', compact = false }) {
  return (
    <div className={`markdown-body${compact ? ' markdown-compact' : ''}${className ? ` ${className}` : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
        }}
      >
        {escapeText(content)}
      </ReactMarkdown>
    </div>
  )
}

function SparkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5L8 2z"
        fill="currentColor"
      />
    </svg>
  )
}

function SparkIconLarge() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  )
}
