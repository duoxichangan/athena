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
