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

  it('routes duplicate, delete, and group toolbar actions for selected elements', () => {
    const duplicateSelection = vi.fn()
    const deleteSelection = vi.fn()
    const groupSelection = vi.fn()
    useEditorStore.setState({
      selectedElementIds: ['text-001', 'text-002'],
      duplicateSelection,
      deleteSelection,
      groupSelection
    })

    render(<Toolbar />)
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate selection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete selection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Group selection' }))

    expect(duplicateSelection).toHaveBeenCalledTimes(1)
    expect(deleteSelection).toHaveBeenCalledTimes(1)
    expect(groupSelection).toHaveBeenCalledTimes(1)
  })

  it('routes ungroup toolbar action for a selected group', () => {
    const ungroupSelection = vi.fn()
    useEditorStore.setState({
      currentSlideId: 'slide-001',
      slides: [
        {
          id: 'slide-001',
          title: 'Grouped',
          background: { type: 'color', value: '#ffffff' },
          elements: [
            {
              id: 'group-001',
              type: 'group',
              x: 100,
              y: 120,
              width: 200,
              height: 100,
              rotation: 0,
              zIndex: 1,
              locked: false,
              visible: true,
              style: {},
              content: { elements: [] }
            }
          ]
        }
      ],
      selectedElementIds: ['group-001'],
      ungroupSelection
    })

    render(<Toolbar />)
    fireEvent.click(screen.getByRole('button', { name: 'Ungroup selection' }))

    expect(ungroupSelection).toHaveBeenCalledTimes(1)
  })

  it('disables selection toolbar actions without enough selection', () => {
    render(<Toolbar />)

    expect(screen.getByRole('button', { name: 'Duplicate selection' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete selection' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Group selection' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ungroup selection' })).toBeDisabled()
  })
})
