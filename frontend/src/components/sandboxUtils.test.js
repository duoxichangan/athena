import { describe, expect, it } from 'vitest'
import { buildPlayerLabels, deviceStrategy, playerPositionAtFrame, resolveFrameBounds } from './sandboxUtils.js'

describe('sand table position mapping', () => {
  it('uses the bottom center of a tracked bounding box', () => {
    const position = playerPositionAtFrame(
      [{ frame: 12, bbox: [100, 40, 200, 240] }],
      12,
      { width: 400, height: 300 },
    )

    expect(position).toEqual({ x: 0.375, y: 0.8 })
  })

  it('falls back to the nearest earlier tracked frame during skipped detections', () => {
    const position = playerPositionAtFrame(
      [{ frame: 8, bbox: [0, 0, 100, 100] }, { frame: 16, bbox: [100, 0, 200, 100] }],
      12,
      { width: 400, height: 200 },
    )

    expect(position).toEqual({ x: 0.125, y: 0.5 })
  })

  it('derives usable frame bounds for older analysis files without dimensions', () => {
    const bounds = resolveFrameBounds({ players: { 1: { frames: [{ bbox: [0, 0, 640, 360] }] } } })

    expect(bounds).toEqual({ width: 640, height: 360 })
  })

  it('requests a rightward adjustment when the tracked player reaches the left edge', () => {
    const strategy = deviceStrategy([{ trackId: 3, x: 0.18, y: 0.6 }])

    expect(strategy.targetId).toBe(3)
    expect(strategy.chassis).toBe('向右补景')
    expect(strategy.gimbal).toBe('向左转向')
    expect(strategy.occlusion).toBe('低')
  })

  it('raises occlusion risk for overlapping players', () => {
    const strategy = deviceStrategy([{ trackId: 1, x: 0.48, y: 0.5 }, { trackId: 2, x: 0.52, y: 0.52 }])

    expect(strategy.occlusion).toBe('高')
    expect(strategy.chassis).toBe('后撤补景')
  })

  it('assigns coach-facing player labels by first appearance and preserves custom names', () => {
    const labels = buildPlayerLabels([
      { track_id: 9, first_seen_frame: 24 },
      { track_id: 2, first_seen_frame: 3 },
    ], { 9: '小王' })

    expect(labels).toEqual({ 2: '学员 1', 9: '小王' })
  })
})
