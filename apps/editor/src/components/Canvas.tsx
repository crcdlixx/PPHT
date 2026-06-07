import { UpdateElementCommand, UpdateElementsCommand, type ElementNode } from '@ppht/core'
import { type PointerEvent, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import { SlideView, type SlideElementFrame } from './SlideView'

type DragState = {
  elements: Array<{
    elementId: string
    originX: number
    originY: number
  }>
  pointerX: number
  pointerY: number
  deltaX: number
  deltaY: number
}

export function Canvas() {
  const slide = useEditorStore((state) => state.currentSlide())
  const zoom = useEditorStore((state) => state.zoom)
  const selectedElementIds = useEditorStore((state) => state.selectedElementIds)
  const selectElement = useEditorStore((state) => state.selectElement)
  const runCommand = useEditorStore((state) => state.runCommand)
  const [drag, setDrag] = useState<DragState>()

  if (slide === undefined) {
    return (
      <div className="canvas-empty" role="status">
        No slide selected
      </div>
    )
  }

  const activeSlide = slide

  function handleElementPointerDown(event: PointerEvent<HTMLDivElement>, element: ElementNode) {
    event.stopPropagation()
    const additive = event.shiftKey || event.ctrlKey || event.metaKey
    const wasSelected = selectedElementIds.includes(element.id)
    const currentSelection = additive
      ? wasSelected
        ? selectedElementIds.filter((selectedId) => selectedId !== element.id)
        : [...selectedElementIds, element.id]
      : wasSelected
        ? selectedElementIds
        : [element.id]

    selectElement(element.id, { additive })

    if (element.locked || (additive && wasSelected)) {
      return
    }

    const draggableElements = activeSlide.elements.filter((item) => currentSelection.includes(item.id) && !item.locked)

    if (draggableElements.length === 0) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      elements: draggableElements.map((item) => ({
        elementId: item.id,
        originX: item.x,
        originY: item.y
      })),
      pointerX: event.clientX,
      pointerY: event.clientY,
      deltaX: 0,
      deltaY: 0
    })
  }

  function handleElementPointerMove(event: PointerEvent<HTMLDivElement>) {
    setDrag((current) => {
      if (current === undefined) {
        return current
      }

      const safeZoom = zoom > 0 ? zoom : 1
      return {
        ...current,
        deltaX: Math.round((event.clientX - current.pointerX) / safeZoom),
        deltaY: Math.round((event.clientY - current.pointerY) / safeZoom)
      }
    })
  }

  function handleElementPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drag === undefined) {
      return
    }

    event.currentTarget.releasePointerCapture(event.pointerId)
    const safeZoom = zoom > 0 ? zoom : 1
    const deltaX = Math.round((event.clientX - drag.pointerX) / safeZoom)
    const deltaY = Math.round((event.clientY - drag.pointerY) / safeZoom)
    setDrag(undefined)

    if (deltaX !== 0 || deltaY !== 0) {
      if (drag.elements.length === 1) {
        const item = drag.elements[0]!
        runCommand(new UpdateElementCommand(item.elementId, { x: item.originX + deltaX, y: item.originY + deltaY }))
        return
      }

      runCommand(new UpdateElementsCommand(drag.elements.map((item) => ({
        elementId: item.elementId,
        patch: { x: item.originX + deltaX, y: item.originY + deltaY }
      })), 'Move selected elements'))
    }
  }

  const frameOverrides: Record<string, SlideElementFrame> = drag === undefined
    ? {}
    : Object.fromEntries(drag.elements.map((item) => [
        item.elementId,
        {
          x: item.originX + drag.deltaX,
          y: item.originY + drag.deltaY
        }
      ]))

  return (
    <div className="canvas-viewport">
      <SlideView
        slide={slide}
        scale={zoom}
        selectedElementIds={selectedElementIds}
        frameOverrides={frameOverrides}
        onSlidePointerDown={() => selectElement()}
        onElementPointerDown={handleElementPointerDown}
        onElementPointerMove={handleElementPointerMove}
        onElementPointerUp={handleElementPointerUp}
      />
    </div>
  )
}
