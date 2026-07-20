// Athena 前端 API 封装 —— 与 FastAPI 后端契约对齐

export async function uploadFile(file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/upload', { method: 'POST', body: fd })
  return res.json()
}

export async function pollStatus(taskId) {
  const res = await fetch(`/status/${taskId}`)
  return res.json()
}

export function downloadUrl(taskId) {
  return `/download/${taskId}`
}

export function dataUrl(taskId) {
  return `/data/${taskId}`
}

export function playerDataUrl(taskId, trackId) {
  return `/data/${taskId}/${trackId}`
}

export function playerClipUrl(taskId, trackId) {
  return `/player-clip/${taskId}/${trackId}`
}

export async function fetchPoseData(taskId) {
  const res = await fetch(`/data/${taskId}`)
  return res.json()
}

export async function analyzePlayer(taskId, trackId, force = false) {
  const url = `/analyze/${taskId}/${trackId}` + (force ? '?force=true' : '')
  const res = await fetch(url, { method: 'POST' })
  return res.json()
}

export async function startLiveSession() {
  const res = await fetch('/live/start', { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || '无法启动实时分析')
  return data
}

export async function sendLiveFrame(sessionId, blob) {
  const form = new FormData()
  form.append('file', blob, 'frame.jpg')
  const res = await fetch(`/live/frame/${sessionId}`, { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || '实时帧分析失败')
  return data
}

export async function stopLiveSession(sessionId) {
  const res = await fetch(`/live/stop/${sessionId}`, { method: 'POST' })
  if (res.status === 404) return { session_id: sessionId, status: 'stopped' }
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || '无法结束实时分析')
  return data
}
