import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../store/editorStore'
import { KeyboardShortcuts } from './KeyboardShortcuts'

describe('KeyboardShortcuts', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState(), true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('routes editor keyboard shortcuts to store actions', () => {
    const copySelection = vi.fn()
    const pasteClipboard = vi.fn()
    const deleteSelection = vi.fn()
    const duplicateSelection = vi.fn()
    const groupSelection = vi.fn()
    const ungroupSelection = vi.fn()
    const undo = vi.fn()
    const redo = vi.fn()
    const saveCurrentSlide = vi.fn().mockResolvedValue(undefined)
    const startPlayback = vi.fn()
    useEditorStore.setState({
      copySelection,
      pasteClipboard,
      deleteSelection,
      duplicateSelection,
      groupSelection,
      undo,
      ungroupSelection,
      redo,
      saveCurrentSlide,
      startPlayback
    })

    render(<KeyboardShortcuts />)

    fireEvent.keyDown(window, { key: 'c', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'Delete' })
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true, shiftKey: true })
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'F5' })

    expect(copySelection).toHaveBeenCalledTimes(1)
    expect(pasteClipboard).toHaveBeenCalledTimes(1)
    expect(deleteSelection).toHaveBeenCalledTimes(1)
    expect(duplicateSelection).toHaveBeenCalledTimes(1)
    expect(groupSelection).toHaveBeenCalledTimes(1)
    expect(ungroupSelection).toHaveBeenCalledTimes(1)
    expect(undo).toHaveBeenCalledTimes(1)
    expect(redo).toHaveBeenCalledTimes(1)
    expect(saveCurrentSlide).toHaveBeenCalledTimes(1)
    expect(startPlayback).toHaveBeenCalledTimes(1)
  })

  it('routes layout keyboard shortcuts before generic clipboard shortcuts', () => {
    const copySelection = vi.fn()
    const pasteClipboard = vi.fn()
    const alignSelection = vi.fn()
    const distributeSelection = vi.fn()
    useEditorStore.setState({
      copySelection,
      pasteClipboard,
      alignSelection,
      distributeSelection
    })

    render(<KeyboardShortcuts />)

    fireEvent.keyDown(window, { key: 'l', ctrlKey: true, altKey: true })
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true, altKey: true })
    fireEvent.keyDown(window, { key: 'r', ctrlKey: true, altKey: true })
    fireEvent.keyDown(window, { key: 't', ctrlKey: true, altKey: true })
    fireEvent.keyDown(window, { key: 'm', ctrlKey: true, altKey: true })
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true, altKey: true })
    fireEvent.keyDown(window, { key: 'h', ctrlKey: true, altKey: true })
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true, altKey: true })

    expect(alignSelection).toHaveBeenNthCalledWith(1, 'left')
    expect(alignSelection).toHaveBeenNthCalledWith(2, 'center')
    expect(alignSelection).toHaveBeenNthCalledWith(3, 'right')
    expect(alignSelection).toHaveBeenNthCalledWith(4, 'top')
    expect(alignSelection).toHaveBeenNthCalledWith(5, 'middle')
    expect(alignSelection).toHaveBeenNthCalledWith(6, 'bottom')
    expect(distributeSelection).toHaveBeenNthCalledWith(1, 'horizontal')
    expect(distributeSelection).toHaveBeenNthCalledWith(2, 'vertical')
    expect(copySelection).not.toHaveBeenCalled()
    expect(pasteClipboard).not.toHaveBeenCalled()
  })

  it('does not handle destructive shortcuts while editing text inputs', () => {
    const deleteSelection = vi.fn()
    useEditorStore.setState({ deleteSelection })

    render(
      <>
        <KeyboardShortcuts />
        <textarea aria-label="Speaker note" />
      </>
    )

    fireEvent.keyDown(screen.getByLabelText('Speaker note'), { key: 'Delete' })

    expect(deleteSelection).not.toHaveBeenCalled()
  })
})
