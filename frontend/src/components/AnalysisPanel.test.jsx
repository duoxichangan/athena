// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AnalysisPanel from './AnalysisPanel.jsx'

vi.mock('../api.js', () => ({
  analyzePlayer: vi.fn(async () => ({
    cached: false,
    analysis: {
      strengths: ['**出手节奏**稳定'],
      weaknesses: [],
      summary: '整体动作连贯。',
      recommendations: [],
      additional_angles: [],
    },
  })),
}))

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('AnalysisPanel', () => {
  it('opens a player analysis dialog with the matching video', async () => {
    const user = userEvent.setup()
    render(<AnalysisPanel taskId="task-1" trackId={7} clipUrl="/clips/player-7.mp4" />)

    await user.click(screen.getByRole('button', { name: /AI/ }))

    const dialog = screen.getByRole('dialog', { name: /7.*AI/ })
    expect(dialog).toBeTruthy()
    expect(dialog.querySelector('video')?.getAttribute('src')).toBe('/clips/player-7.mp4')
    expect(document.body.style.overflow).toBe('hidden')
    await waitFor(() => expect(screen.getByText('出手节奏')).toBeTruthy())
  })

  it('closes the dialog when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(<AnalysisPanel taskId="task-1" trackId={7} clipUrl="/clips/player-7.mp4" />)

    await user.click(screen.getByRole('button', { name: /AI/ }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })
})
