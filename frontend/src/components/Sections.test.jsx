// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Footer, Header } from './Sections.jsx'

afterEach(cleanup)

describe('frontend branding', () => {
  it('shows 篮眸 in the header and footer', () => {
    render(<><Header /><Footer /></>)

    expect(screen.getByText('篮眸')).toBeTruthy()
    expect(screen.getByText('篮眸 运动员姿态识别平台')).toBeTruthy()
  })
})
