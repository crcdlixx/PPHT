import { UpdateElementCommand, type ElementNode } from '@ppht/core'
import { type PointerEvent, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import { SlideView, type SlideElementFrame } from './SlideView'

type DragState = {
  elementId: string
  originX: number
  originY: number
  pointerX: number
  pointerY: number
  x: number
  y: number
}

export function Canvas() {
  const slide = useEditorStore((state) => state.currentSlide())
  const zoom = useEditorStore((state) => state.zoom)
  const selectedElementIds = useEditorStore((state) => state.selectedElementIds)
  const selectElement = useEditorStore((state) => state.selectElement)
  const runCommand = useEditorStore((state) => state.runCommand)
  const [drag, setDrag] = useState<DragState>()
  const selectedElementId = selectedElementIds[0]

  if (slide === undefined) {
    return (
      <div className="canvas-empty" role="status">
        No slide selected
      </div>
    )
  }

  function handleElementPointerDown(event: PointerEvent<HTMLDivElement>, element: ElementNode) {
    event.stopPropagation()
    selectElement(element.id)

    if (element.locked) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      elementId: element.id,
      originX: element.x,
      originY: element.y,
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: element.x,
      y: element.y
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
        x: Math.round(current.originX + (event.clientX - current.pointerX) / safeZoom),
        y: Math.round(current.originY + (event.clientY - current.pointerY) / safeZoom)
      }
    })
  }

  function handleElementPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drag === undefined) {
      return
    }

    event.currentTarget.releasePointerCapture(event.pointerId)
    const safeZoom = zoom > 0 ? zoom : 1
    const x = Math.round(drag.originX + (event.clientX - drag.pointerX) / safeZoom)
    const y = Math.round(drag.originY + (event.clientY - drag.pointerY) / safeZoom)
    setDrag(undefined)

    if (x !== drag.originX || y !== drag.originY) {
      runCommand(new UpdateElementCommand(drag.elementId, { x, y }))
    }
  }

  const frameOverrides: Record<string, SlideElementFrame> =
    drag === undefined
      ? {}
      : {
          [drag.elementId]: {
            x: drag.x,
            y: drag.y
          }
        }

  return (
    <div className="canvas-viewport">
      <SlideView
        slide={slide}
        scale={zoom}
        selectedElementId={selectedElementId}
        frameOverrides={frameOverrides}
        onSlidePointerDown={() => selectElement()}
        onElementPointerDown={handleElementPointerDown}
        onElementPointerMove={handleElementPointerMove}
        onElementPointerUp={handleElementPointerUp}
      />
    </div>
  )
}
