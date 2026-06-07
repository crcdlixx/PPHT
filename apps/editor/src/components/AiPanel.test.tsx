import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../store/editorStore'
import { AiPanel } from './AiPanel'

describe('AiPanel', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState(), true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('submits the typed instruction for an AI suggestion', async () => {
    const requestAiSuggestion = vi.fn().mockResolvedValue(undefined)
    useEditorStore.setState({
      currentSlideId: 'slide-001',
      requestAiSuggestion
    })

    render(<AiPanel />)

    fireEvent.change(screen.getByLabelText('AI instruction'), {
      target: { value: 'Make the title sharper' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }))

    expect(requestAiSuggestion).toHaveBeenCalledWith('Make the title sharper')
  })

  it('accepts and rejects pending AI suggestions from the panel controls', () => {
    const acceptAiSuggestion = vi.fn()
    const rejectAiSuggestion = vi.fn()
    useEditorStore.setState({
      currentSlideId: 'slide-001',
      pendingAiSuggestion: {
        summary: 'Added headline',
        beforeSlide: {
          id: 'slide-001',
          title: 'Intro',
          background: { type: 'color', value: '#ffffff' },
          elements: []
        },
        afterSlide: {
          id: 'slide-001',
          title: 'Sharper Intro',
          background: { type: 'color', value: '#ffffff' },
          elements: [
            {
              id: 'text-ai',
              type: 'text',
              x: 120,
              y: 120,
              width: 360,
              height: 90,
              rotation: 0,
              zIndex: 1,
              locked: false,
              visible: true,
              style: {},
              content: { text: 'AI copy' }
            }
          ]
        },
        changedElementIds: ['text-ai']
      },
      acceptAiSuggestion,
      rejectAiSuggestion
    })

    render(<AiPanel />)

    expect(screen.getByText('Added headline')).toBeInTheDocument()
    expect(screen.getByText('Before')).toBeInTheDocument()
    expect(screen.getByText('Intro')).toBeInTheDocument()
    expect(screen.getByText('After')).toBeInTheDocument()
    expect(screen.getByText('Sharper Intro')).toBeInTheDocument()
    expect(screen.getByText('Elements 0 -> 1')).toBeInTheDocument()
    expect(screen.getByText('Changed text-ai')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))

    expect(acceptAiSuggestion).toHaveBeenCalledTimes(1)
    expect(rejectAiSuggestion).toHaveBeenCalledTimes(1)
  })

  it('keeps actions disabled without a pending suggestion and rolls back accepted AI edits', () => {
    const rollbackLastAiSuggestion = vi.fn()
    useEditorStore.setState({
      currentSlideId: 'slide-001',
      lastAiSuggestion: {
        summary: 'Previous AI edit',
        beforeSlide: {
          id: 'slide-001',
          title: 'Intro',
          background: { type: 'color', value: '#ffffff' },
          elements: []
        },
        afterSlide: {
          id: 'slide-001',
          title: 'Intro',
          background: { type: 'color', value: '#ffffff' },
          elements: []
        },
        changedElementIds: []
      },
      rollbackLastAiSuggestion
    })

    render(<AiPanel />)

    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Rollback' }))

    expect(rollbackLastAiSuggestion).toHaveBeenCalledTimes(1)
  })
})
