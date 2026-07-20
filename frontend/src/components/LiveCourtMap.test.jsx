// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import LiveCourtMap from './LiveCourtMap.jsx'

afterEach(cleanup)

describe('LiveCourtMap', () => {
  it('shows the relative-position label and tracked players', () => {
    render(
      <LiveCourtMap
        players={[{ track_id: 7, x: 0.4, y: 0.7 }]}
        history={{}}
      />,
    )

    expect(screen.getByText('相对位置')).toBeTruthy()
    expect(screen.getByLabelText('学员 7')).toBeTruthy()
  })
})
