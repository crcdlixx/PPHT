import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSlide } from '@ppht/core'
import { useEditorStore } from '../store/editorStore'
import { PlaybackView } from './PlaybackView'

describe('PlaybackView', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState(), true)
    useEditorStore.setState({
      slides: [createSlide('slide-001', 'Intro'), createSlide('slide-002', 'Second')],
      currentSlideId: 'slide-001',
      isPresenting: true,
      playbackSlideId: 'slide-001'
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('navigates with controls, keyboard, and escape', () => {
    render(<PlaybackView />)

    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'End' })
    expect(screen.getByText('2 / 2')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useEditorStore.getState().isPresenting).toBe(false)
  })

  it('requests fullscreen for the playback surface', () => {
    const requestFullscreen = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen
    })

    render(<PlaybackView />)
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }))

    expect(requestFullscreen).toHaveBeenCalledTimes(1)
  })
})
