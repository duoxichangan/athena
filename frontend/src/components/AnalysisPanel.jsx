import { useState } from 'react'
import { analyzePlayer } from '../api.js'

function escapeText(s) {
  return s == null ? '' : String(s)
}

export default function AnalysisPanel({ taskId, trackId }) {
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

      {open && (
        <div className="analysis-result">
          {loading && (
            <div className="analysis-thinking">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <span>AI 正在折射动作细节...</span>
            </div>
          )}

          {!loading && data?.error && (
            <div className="analysis-error">{escapeText(data.error)}</div>
          )}

          {!loading && a && (
            <div className="analysis-content">
              {data.cached && <span className="cached-badge">缓存结果</span>}

              {a.strengths?.length > 0 && (
                <Section title="优势" variant="strengths" items={a.strengths} />
              )}
              {a.weaknesses?.length > 0 && (
                <Section title="短板" variant="weaknesses" items={a.weaknesses} />
              )}
              {a.summary && (
                <div className="analysis-section">
                  <div className="section-title summary">总体评价</div>
                  <p className="summary-text">{escapeText(a.summary)}</p>
                </div>
              )}
              {a.recommendations?.length > 0 && (
                <Section title="改进建议" variant="recommendations" items={a.recommendations} />
              )}
              {a.additional_angles?.length > 0 && (
                <Section title="补充观察建议" variant="additional" items={a.additional_angles} />
              )}

              {!a.strengths && !a.weaknesses && !a.summary && !a.recommendations && !a.additional_angles && a.raw_response && (
                <p className="summary-text">{escapeText(a.raw_response)}</p>
              )}

              <button className="btn-reanalyze" onClick={() => run(true)}>
                重新分析
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, variant, items }) {
  return (
    <div className="analysis-section">
      <div className={`section-title ${variant}`}>{title}</div>
      <ul className={`analysis-list ${variant}-list`}>
        {items.map((it, i) => (
          <li key={i}>{escapeText(it)}</li>
        ))}
      </ul>
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
