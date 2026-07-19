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
