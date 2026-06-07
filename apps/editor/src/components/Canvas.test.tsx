import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandHistory, createSlide, createTextElement, type SlideDocument } from '@ppht/core'
import { useEditorStore } from '../store/editorStore'
import { Canvas } from './Canvas'

function dispatchPointerEvent(element: Element, type: string, options: MouseEventInit & { pointerId?: number }) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...options })
  Object.defineProperty(event, 'pointerId', { value: options.pointerId ?? 1 })
  fireEvent(element, event)
}

function createCanvasSlide(): SlideDocument {
  return {
    ...createSlide('slide-001', 'Canvas'),
    elements: [
      createTextElement('text-001', { x: 10, y: 20, width: 120, height: 50 }, 'One'),
      createTextElement('text-002', { x: 220, y: 80, width: 120, height: 50 }, 'Two')
    ]
  }
}

describe('Canvas', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState(), true)
    HTMLElement.prototype.setPointerCapture = vi.fn()
    HTMLElement.prototype.releasePointerCapture = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('does not drag remaining selected elements when modifier-click deselects an element', () => {
    const slide = createCanvasSlide()
    useEditorStore.setState({
      currentSlideId: slide.id,
      slides: [slide],
      selectedElementIds: ['text-001', 'text-002'],
      history: new CommandHistory(slide),
      zoom: 1
    })

    const { container } = render(<Canvas />)
    const firstElement = container.querySelector('[data-element-id="text-001"]')

    expect(firstElement).not.toBeNull()

    dispatchPointerEvent(firstElement!, 'pointerdown', { clientX: 10, clientY: 20, pointerId: 1, shiftKey: true })
    dispatchPointerEvent(firstElement!, 'pointermove', { clientX: 40, clientY: 50, pointerId: 1, shiftKey: true })
    dispatchPointerEvent(firstElement!, 'pointerup', { clientX: 40, clientY: 50, pointerId: 1, shiftKey: true })

    const state = useEditorStore.getState()
    expect(state.selectedElementIds).toEqual(['text-002'])
    expect(state.slides[0]?.elements.find((element) => element.id === 'text-002')).toEqual(slide.elements[1])
  })
})
