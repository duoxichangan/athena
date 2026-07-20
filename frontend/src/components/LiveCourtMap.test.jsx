// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import LiveCourtMap from './LiveCourtMap.jsx'

afterEach(cleanup)

describe('LiveCourtMap', () => {
  it('renders the court map with tracked player dots', () => {
    render(
      <LiveCourtMap
        players={[{ track_id: 7, x: 0.4, y: 0.7 }]}
        history={{}}
      />,
    )

    expect(screen.getByLabelText('实时半场位置图')).toBeTruthy()
    expect(screen.getByLabelText('学员 7')).toBeTruthy()
  })
})
