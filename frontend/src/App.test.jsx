// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App.jsx'

afterEach(cleanup)

describe('App entry modes', () => {
  it('offers real-time training and recorded-video review together', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: '开启实时训练，调用电脑摄像头' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '录像复盘' })).toBeTruthy()
  })
})
