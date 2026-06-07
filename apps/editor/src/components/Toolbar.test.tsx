import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../store/editorStore'
import { Toolbar } from './Toolbar'

describe('Toolbar', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState(), true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('prompts for project details before creating a project', () => {
    const createProject = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(window, 'prompt')
      .mockReturnValueOnce('D:/Decks/new.ppht')
      .mockReturnValueOnce('Quarterly Review')
    useEditorStore.setState({ createProject })

    render(<Toolbar />)
    fireEvent.click(screen.getByRole('button', { name: 'New' }))

    expect(window.prompt).toHaveBeenCalledWith('Project folder path')
    expect(window.prompt).toHaveBeenCalledWith('Project title')
    expect(createProject).toHaveBeenCalledWith('D:/Decks/new.ppht', 'Quarterly Review')
  })

  it('prompts for a project path before opening a project', () => {
    const openProject = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(window, 'prompt').mockReturnValue('D:/Decks/existing.ppht')
    useEditorStore.setState({ openProject })

    render(<Toolbar />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(window.prompt).toHaveBeenCalledWith('Project folder path to open')
    expect(openProject).toHaveBeenCalledWith('D:/Decks/existing.ppht')
  })

  it('prompts for an HTML path before importing a slide', () => {
    const importHtmlSlide = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(window, 'prompt').mockReturnValue('D:/Decks/imported.html')
    useEditorStore.setState({
      projectPath: 'D:/Decks/demo',
      importHtmlSlide
    })

    render(<Toolbar />)
    fireEvent.click(screen.getByRole('button', { name: 'Import HTML' }))

    expect(window.prompt).toHaveBeenCalledWith('HTML file path to import')
    expect(importHtmlSlide).toHaveBeenCalledWith('D:/Decks/imported.html')
  })

  it('skips HTML import when the path prompt is empty', () => {
    const importHtmlSlide = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(window, 'prompt').mockReturnValue('  ')
    useEditorStore.setState({
      projectPath: 'D:/Decks/demo',
      importHtmlSlide
    })

    render(<Toolbar />)
    fireEvent.click(screen.getByRole('button', { name: 'Import HTML' }))

    expect(importHtmlSlide).not.toHaveBeenCalled()
  })
})
