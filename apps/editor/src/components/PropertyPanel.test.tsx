import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSlide, createTextElement } from '@ppht/core'
import { useEditorStore } from '../store/editorStore'
import { PropertyPanel } from './PropertyPanel'

describe('PropertyPanel', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState(), true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('runs alignment controls for a multi-selection', () => {
    const alignSelection = vi.fn()
    useEditorStore.setState({
      slides: [{
        ...createSlide('slide-001', 'Intro'),
        elements: [
          createTextElement('text-001', { x: 10, y: 20, width: 100, height: 40 }, 'One'),
          createTextElement('text-002', { x: 120, y: 80, width: 100, height: 40 }, 'Two')
        ]
      }],
      currentSlideId: 'slide-001',
      selectedElementIds: ['text-001', 'text-002'],
      alignSelection
    })

    render(<PropertyPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Align left' }))

    expect(alignSelection).toHaveBeenCalledWith('left')
  })

  it('applies text color through selected style controls', () => {
    const updateSelectedElementStyles = vi.fn()
    useEditorStore.setState({
      slides: [{
        ...createSlide('slide-001', 'Intro'),
        elements: [
          createTextElement('text-001', { x: 10, y: 20, width: 100, height: 40 }, 'One')
        ]
      }],
      currentSlideId: 'slide-001',
      selectedElementIds: ['text-001'],
      updateSelectedElementStyles
    })

    render(<PropertyPanel />)
    fireEvent.change(screen.getByLabelText('Text color'), { target: { value: '#dc2626' } })

    expect(updateSelectedElementStyles).toHaveBeenCalledWith({ color: '#dc2626' })
  })

  it('runs layer step controls for a selection', () => {
    const arrangeSelection = vi.fn()
    useEditorStore.setState({
      slides: [{
        ...createSlide('slide-001', 'Intro'),
        elements: [
          createTextElement('text-001', { x: 10, y: 20, width: 100, height: 40 }, 'One')
        ]
      }],
      currentSlideId: 'slide-001',
      selectedElementIds: ['text-001'],
      arrangeSelection
    })

    render(<PropertyPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Bring forward' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send backward' }))

    expect(arrangeSelection).toHaveBeenCalledWith('forward')
    expect(arrangeSelection).toHaveBeenCalledWith('backward')
  })
})
