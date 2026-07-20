// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startLiveSession, stopLiveSession } from '../api.js'
import LiveTraining, { appendHistory } from './LiveTraining.jsx'

const stylesText = readFileSync('src/styles.css', 'utf8')

vi.mock('../api.js', () => ({
  startLiveSession: vi.fn(),
  sendLiveFrame: vi.fn(),
  stopLiveSession: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('LiveTraining', () => {
  it('shows a permission error when camera access is denied', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })

    render(<LiveTraining />)
    await userEvent.click(screen.getByRole('button', { name: '开启实时训练' }))

    expect(await screen.findByText('无法访问电脑摄像头，请检查浏览器权限。')).toBeTruthy()
  })

  it('shows the court map in the upper video overlay and releases the camera on unmount', async () => {
    const stopTrack = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) },
      configurable: true,
    })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    startLiveSession.mockResolvedValue({ session_id: 'live-1', status: 'live' })
    stopLiveSession.mockResolvedValue({ session_id: 'live-1', status: 'stopped' })

    const view = render(<LiveTraining />)
    await userEvent.click(screen.getByRole('button', { name: '开启实时训练' }))

    expect(await screen.findByLabelText('实时半场位置图')).toBeTruthy()
    expect(screen.getByLabelText('实时半场位置图').parentElement.className).toContain('live-video-stage')

    view.unmount()
    await waitFor(() => expect(stopTrack).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(stopLiveSession).toHaveBeenCalledWith('live-1'))
  })

  it('shows the local camera preview before the AI session finishes starting', async () => {
    let resolveSession
    startLiveSession.mockImplementation(() => new Promise((resolve) => { resolveSession = resolve }))
    const stream = { getTracks: () => [] }
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
      configurable: true,
    })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()

    render(<LiveTraining />)
    await userEvent.click(screen.getByRole('button', { name: '开启实时训练' }))

    await waitFor(() => expect(screen.queryByText('开启摄像头后，这里将显示训练画面')).toBeNull())
    expect(screen.getByLabelText('实时训练画面').srcObject).toBe(stream)

    resolveSession({ session_id: 'live-delayed', status: 'live' })
  })

  it('keeps the local preview visible when the AI session cannot start', async () => {
    const stopTrack = vi.fn()
    const stream = { getTracks: () => [{ stop: stopTrack }] }
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
      configurable: true,
    })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    startLiveSession.mockRejectedValue(new Error('backend unavailable'))

    render(<LiveTraining />)
    await userEvent.click(screen.getByRole('button', { name: '开启实时训练' }))

    expect(await screen.findByText('AI 实时标注暂不可用，摄像头画面仍可继续查看。')).toBeTruthy()
    expect(screen.getByLabelText('实时训练画面').srcObject).toBe(stream)
    expect(stopTrack).not.toHaveBeenCalled()
  })

  it('centers the real-time training card in the page container', () => {
    render(<LiveTraining />)
    expect(screen.getByRole('region', { name: '实时训练' })).toBeTruthy()

    expect(stylesText).toMatch(/\.live-training-section\s*\{[^}]*margin-left:\s*auto;[^}]*margin-right:\s*auto;/)
  })

  it('keeps only the latest 30 trail positions per player', () => {
    let history = {}
    for (let index = 0; index < 35; index += 1) {
      history = appendHistory(history, [{ track_id: 3, x: index / 100, y: 0.5 }])
    }

    expect(history[3]).toHaveLength(30)
    expect(history[3][0].x).toBe(0.05)
  })
})
