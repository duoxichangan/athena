import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { analyzePlayer } from '../api.js'

function escapeText(s) {
  return s == null ? '' : String(s)
}

export default function AnalysisPanel({ taskId, trackId, clipUrl }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null) // {analysis, cached, error}

  async function run(force = false) {
    setOpen(true)
    setLoading(true)
    setData(null)
    try {
      const res = await analyzePlayer(taskId, trackId, force)
      setData(res)
    } catch (err) {
      setData({ error: '网络错误: ' + err.message })
    } finally {
      setLoading(false)
    }
  }

  const a = data?.analysis

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

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
              <div>
                <span className="analysis-modal-eyebrow">篮眸 · 运动表现报告</span>
                <h2 id={`analysis-title-${trackId}`}>球员 {trackId} · AI 分析</h2>
              </div>
              <button className="analysis-modal-close" type="button" onClick={() => setOpen(false)} aria-label="关闭分析弹窗">
                ×
              </button>
            </header>

            <div className="analysis-modal-grid">
              <aside className="analysis-modal-video">
                <div className="analysis-video-label">动作视频</div>
                {clipUrl ? (
                  <video src={clipUrl} controls loop preload="metadata" />
                ) : (
                  <div className="analysis-video-empty">该球员视频仍在生成中</div>
                )}
                <p>播放视频，对照右侧建议逐项检查动作细节。</p>
              </aside>

              <div className="analysis-modal-report">
                {loading && <AnalysisThinking />}
                {!loading && data?.error && <div className="analysis-error">{escapeText(data.error)}</div>}
                {!loading && a && <AnalysisContent analysis={a} cached={data.cached} onReanalyze={() => run(true)} />}
              </div>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  )
}

function AnalysisThinking() {
  return (
    <div className="analysis-thinking">
      <span className="dot" /><span className="dot" /><span className="dot" />
      <span>AI 正在分析动作细节...</span>
    </div>
  )
}

function AnalysisContent({ analysis: a, cached, onReanalyze }) {
  return (
    <div className="analysis-content">
      {cached && <span className="cached-badge">缓存结果</span>}
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
