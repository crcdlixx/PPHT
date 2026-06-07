import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { useEditorStore } from './store/editorStore'

vi.mock('./components/Canvas', () => ({
  Canvas: () => <div data-testid="canvas" />
}))

vi.mock('./components/PlaybackView', () => ({
  PlaybackView: () => null
}))

vi.mock('./components/PropertyPanel', () => ({
  PropertyPanel: () => null
}))

vi.mock('./components/SlideRail', () => ({
  SlideRail: () => null
}))

vi.mock('./components/StatusBar', () => ({
  StatusBar: () => null
}))

describe('App', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState(), true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('mounts editor keyboard shortcuts with the application shell', () => {
    const copySelection = vi.fn()
    useEditorStore.setState({ copySelection })

    render(<App />)
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true })

    expect(copySelection).toHaveBeenCalledTimes(1)
  })
})
