// COCO-17 骨架绘制（与后端 config 一致）

export const SKELETON_EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 4], // face
  [5, 6], [5, 7], [6, 8], [7, 9], [8, 10], // upper body
  [5, 11], [6, 12], [11, 12], // torso-hip
  [11, 13], [12, 14], [13, 15], [14, 16], // legs
]

const KPT_GROUPS = {
  head: [0, 1, 2, 3, 4],
  torso: [5, 6, 11, 12],
  left_arm: [7, 9],
  right_arm: [8, 10],
  left_leg: [13, 15],
  right_leg: [14, 16],
}
const GROUP_COLORS = {
  head: '#ffffff',
  torso: '#00e5ff',
  left_arm: '#ff5252',
  right_arm: '#69f0ae',
  left_leg: '#ff40a0',
  right_leg: '#ffd740',
}

function colorFor(idx) {
  for (const [group, indices] of Object.entries(KPT_GROUPS)) {
    if (indices.includes(idx)) return GROUP_COLORS[group] || '#00ff88'
  }
  return '#00ff88'
}

// keypoints: [[x, y, conf], ...] 绝对像素坐标
export function drawSkeleton(canvas, keypoints) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  keypoints.forEach(([kx, ky, kc]) => {
    if (kc > 0.3) {
      minX = Math.min(minX, kx)
      minY = Math.min(minY, ky)
      maxX = Math.max(maxX, kx)
      maxY = Math.max(maxY, ky)
    }
  })
  if (!isFinite(minX)) return

  const pad = 30
  const kptW = maxX - minX || 1
  const kptH = maxY - minY || 1
  const scale = Math.min((w - pad * 2) / kptW, (h - pad * 2) / kptH)
  const offsetX = (w - kptW * scale) / 2 - minX * scale
  const offsetY = (h - kptH * scale) / 2 - minY * scale
  const tx = (kx) => kx * scale + offsetX
  const ty = (ky) => ky * scale + offsetY

  ctx.lineWidth = 2
  SKELETON_EDGES.forEach(([i, j]) => {
    if (keypoints[i][2] > 0.3 && keypoints[j][2] > 0.3) {
      ctx.strokeStyle = 'rgba(0,255,160,0.75)'
      ctx.beginPath()
      ctx.moveTo(tx(keypoints[i][0]), ty(keypoints[i][1]))
      ctx.lineTo(tx(keypoints[j][0]), ty(keypoints[j][1]))
      ctx.stroke()
    }
  })

  keypoints.forEach(([kx, ky, kc], idx) => {
    if (kc < 0.3) return
    const x = tx(kx)
    const y = ty(ky)
    ctx.fillStyle = colorFor(idx)
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.stroke()
  })
}
