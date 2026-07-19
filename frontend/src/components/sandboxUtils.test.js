import { describe, expect, it } from 'vitest'
import { playerPositionAtFrame, resolveFrameBounds } from './sandboxUtils.js'

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
})
