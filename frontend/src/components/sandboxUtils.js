export function resolveFrameBounds(poseData) {
  const meta = poseData?.meta || {}
  if (meta.frame_width > 0 && meta.frame_height > 0) return { width: meta.frame_width, height: meta.frame_height }
  let width = 1
  let height = 1
  Object.values(poseData?.players || {}).forEach((player) => player.frames?.forEach((frame) => {
    const bbox = frame.bbox || []
    width = Math.max(width, bbox[2] || 0)
    height = Math.max(height, bbox[3] || 0)
  }))
  return { width, height }
}

export function playerPositionAtFrame(frames, targetFrame, bounds) {
  if (!frames?.length || !bounds?.width || !bounds?.height) return null
  let candidate = null
  for (const frame of frames) {
    if (frame.frame > targetFrame) break
    candidate = frame
  }
  if (!candidate?.bbox) return null
  const [x1, , x2, y2] = candidate.bbox
  return { x: Math.max(0, Math.min(1, ((x1 + x2) / 2) / bounds.width)), y: Math.max(0, Math.min(1, y2 / bounds.height)) }
}

export function trajectoryUntilFrame(frames, targetFrame, bounds, maxPoints = 40) {
  return (frames || []).filter((frame) => frame.frame <= targetFrame).slice(-maxPoints)
    .map((frame) => playerPositionAtFrame([frame], frame.frame, bounds)).filter(Boolean)
}

export function deviceStrategy(positions) {
  if (!positions?.length) return { targetId: null, chassis: '待命', gimbal: '扫描场地', occlusion: '未知', safety: '正常' }
  const target = positions[0]
  const overlapping = positions.some((a, index) => positions.slice(index + 1).some((b) => Math.hypot(a.x - b.x, a.y - b.y) < 0.09))
  if (overlapping) return { targetId: target.trackId, chassis: '后撤补景', gimbal: '自动居中', occlusion: '高', safety: '正常' }
  if (target.x < 0.3) return { targetId: target.trackId, chassis: '向右补景', gimbal: '向左转向', occlusion: '低', safety: '正常' }
  if (target.x > 0.7) return { targetId: target.trackId, chassis: '向左补景', gimbal: '向右转向', occlusion: '低', safety: '正常' }
  return { targetId: target.trackId, chassis: '原地跟随', gimbal: '自动居中', occlusion: '低', safety: '正常' }
}

export function buildPlayerLabels(players, customNames = {}) {
  return [...(players || [])]
    .sort((a, b) => (a.first_seen_frame || 0) - (b.first_seen_frame || 0))
    .reduce((labels, player, index) => ({
      ...labels,
      [player.track_id]: customNames[player.track_id]?.trim() || `学员 ${index + 1}`,
    }), {})
}
