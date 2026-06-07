import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandHistory, createSlide, createTextElement, type SlideDocument } from '@ppht/core'
import { useEditorStore } from '../store/editorStore'
import { Canvas } from './Canvas'

type ResizeObserverEntryLike = {
  contentRect: {
    width: number
    height: number
  }
}

const resizeObservers: Array<(entries: ResizeObserverEntryLike[]) => void> = []

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
    resizeObservers.length = 0
    useEditorStore.setState(useEditorStore.getInitialState(), true)
    HTMLElement.prototype.setPointerCapture = vi.fn()
    HTMLElement.prototype.releasePointerCapture = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(private readonly callback: (entries: ResizeObserverEntryLike[]) => void) {
        resizeObservers.push(callback)
      }

      observe() {}
      disconnect() {}
    })
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

  it('fits a new slide to the available canvas viewport', () => {
    const slide = createCanvasSlide()
    useEditorStore.setState({
      currentSlideId: slide.id,
      slides: [slide],
      selectedElementIds: [],
      history: new CommandHistory(slide),
      zoom: 0.45
    })

    const { container } = render(<Canvas />)
    act(() => {
      resizeObservers[0]?.([{ contentRect: { width: 960, height: 540 } }])
    })

    const frame = container.querySelector('.canvas-slide-frame')
    expect(frame).toHaveStyle({ width: '960px', height: '540px' })
  })

  it('selects elements covered by a marquee drag on the slide surface', () => {
    const slide = createCanvasSlide()
    useEditorStore.setState({
      currentSlideId: slide.id,
      slides: [slide],
      selectedElementIds: [],
      history: new CommandHistory(slide),
      zoom: 1
    })

    const { container } = render(<Canvas />)
    const slideSurface = container.querySelector('.canvas-slide')

    expect(slideSurface).not.toBeNull()

    dispatchPointerEvent(slideSurface!, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 })
    dispatchPointerEvent(slideSurface!, 'pointermove', { clientX: 180, clientY: 110, pointerId: 1 })

    const marquee = container.querySelector('.canvas-marquee')
    expect(marquee).toHaveStyle({ left: '0px', top: '0px', width: '180px', height: '110px' })

    dispatchPointerEvent(slideSurface!, 'pointerup', { clientX: 180, clientY: 110, pointerId: 1 })

    expect(useEditorStore.getState().selectedElementIds).toEqual(['text-001'])
    expect(container.querySelector('.canvas-marquee')).toBeNull()
  })
})
